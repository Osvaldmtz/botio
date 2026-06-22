/**
 * Rescate one-off — 38 leads perdidos durante outage 20-21 jun 2026.
 *
 * DRY-RUN (default): npx tsx scripts/rescue-lost-leads-21jun.ts
 * PRODUCTION:        DRY_RUN=false npx tsx scripts/rescue-lost-leads-21jun.ts
 */
// @ts-nocheck — one-off script, not part of app runtime
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import {
  EXCLUDED_PHONES,
  hoursSince,
  normalizePhone,
  phonesMatch,
  selectRescueTemplate,
  type LostLeadRecord,
} from '../lib/lost-leads-21jun';

function loadEnvLocal(): void {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvLocal();

const DRY_RUN = process.env.DRY_RUN !== 'false';
const TWILIO_FROM = 'whatsapp:+15559374917';
const BOT_ID = process.env.KALYO_BOT_ID ?? '64f6eed2-1522-48fe-a2c6-f858b767df06';
const LEADS_PATH = join(process.cwd(), 'lib/lost-leads-21jun.json');

function loadLeads(): LostLeadRecord[] {
  if (!existsSync(LEADS_PATH)) {
    throw new Error(
      `Missing ${LEADS_PATH}. Run: npx tsx scripts/diagnose-lost-leads-21jun.ts --export`,
    );
  }
  return JSON.parse(readFileSync(LEADS_PATH, 'utf8')) as LostLeadRecord[];
}

async function sendTelegramAlert(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[telegram] missing env — skipping alert');
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    console.error('[telegram] failed', res.status, await res.text());
  }
}

async function findConversation(
  supabase: SupabaseClient,
  phone: string,
): Promise<{ id: string; metadata: Record<string, unknown> | null; customer_phone: string } | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, metadata, customer_phone')
    .eq('bot_id', BOT_ID);

  if (error) throw new Error(`findConversation: ${error.message}`);

  return (
    (data ?? []).find((c) => phonesMatch(c.customer_phone, phone)) ?? null
  );
}

async function rescueLead(
  lead: LostLeadRecord,
  twilioClient: ReturnType<typeof twilio>,
  supabase: SupabaseClient,
): Promise<{ success: boolean; dryRun?: boolean; sid?: string; error?: string }> {
  const template = selectRescueTemplate(lead);

  if (DRY_RUN) {
    console.log(`\n[DRY-RUN] ${lead.group} | ${lead.phone} | ${hoursSince(lead.firstInboundAt)}h ago`);
    console.log(`  ${lead.firstMsg.slice(0, 50)}`);
    console.log(`  Preview: ${template.slice(0, 120).replace(/\n/g, ' ')}…`);
    return { success: true, dryRun: true };
  }

  try {
    const message = await twilioClient.messages.create({
      from: TWILIO_FROM,
      to: `whatsapp:${lead.phone}`,
      body: template,
    });

    console.log(`✅ ${lead.phone} (${lead.group}) → ${message.sid}`);

    const now = new Date().toISOString();
    const rescueMeta = {
      rescue_outage_21jun: true,
      rescue_template_group: lead.group,
      rescue_sent_at: now,
      original_msg: lead.firstMsg,
    };

    const existing = await findConversation(supabase, lead.phone);

    let conversationId: string;

    if (existing) {
      conversationId = existing.id;
      const mergedMeta = {
        ...(typeof existing.metadata === 'object' && existing.metadata ? existing.metadata : {}),
        ...rescueMeta,
      };
      const { error: updateErr } = await supabase
        .from('conversations')
        .update({
          metadata: mergedMeta,
          last_message_at: now,
        })
        .eq('id', existing.id);
      if (updateErr) throw updateErr;
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from('conversations')
        .insert({
          bot_id: BOT_ID,
          customer_phone: normalizePhone(lead.phone),
          channel: 'whatsapp',
          pipeline_stage: 'new',
          is_ambassador: false,
          metadata: {
            source: 'rescue_outage_21jun',
            ...rescueMeta,
          },
          last_message_at: now,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      conversationId = inserted.id;
    }

    const { error: msgErr } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: template,
      created_at: now,
    });
    if (msgErr) throw msgErr;

    return { success: true, sid: message.sid };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${lead.phone}: ${msg}`);
    return { success: false, error: msg };
  }
}

function printTable(leads: LostLeadRecord[]): void {
  console.log('Grupo   | Phone           | Horas | Categoría  | Primer mensaje');
  console.log('--------|-----------------|-------|------------|------------------');
  for (const lead of leads) {
    const hrs = String(hoursSince(lead.firstInboundAt)).padStart(5);
    console.log(
      `${lead.group.padEnd(7)} | ${lead.phone.padEnd(15)} | ${hrs} | ${lead.category.padEnd(10)} | ${lead.firstMsg.slice(0, 40)}`,
    );
  }
}

function printDistribution(leads: LostLeadRecord[]): void {
  const groups = { A: 0, B_LUIS: 0, B_2PSI: 0, C: 0 };
  for (const l of leads) groups[l.group]++;
  console.log('\nDistribución por template:');
  console.log(`  Grupo A (HOT precio/interés): ${groups.A}`);
  console.log(`  Grupo B_LUIS (Luis Alberto):  ${groups.B_LUIS}`);
  console.log(`  Grupo B_2PSI (2 psicólogos):  ${groups.B_2PSI}`);
  console.log(`  Grupo C (cold estándar):      ${groups.C}`);
  console.log(`  TOTAL:                        ${leads.length}`);
}

async function main(): Promise<void> {
  const allLeads = loadLeads();
  const leadsToRescue = allLeads.filter(
    (l) => !EXCLUDED_PHONES.some((ex) => phonesMatch(ex, l.phone)),
  );

  console.log(`🚑 Rescate leads outage 20-21 jun — ${DRY_RUN ? 'DRY-RUN' : '⚠️  PRODUCTION'}`);
  console.log(`Total en JSON: ${allLeads.length} | A rescatar: ${leadsToRescue.length}\n`);

  printTable(leadsToRescue);
  printDistribution(leadsToRescue);

  if (DRY_RUN) {
    console.log('\n━━━ TEMPLATE PREVIEWS ━━━\n');
    for (const group of ['A', 'B_LUIS', 'B_2PSI', 'C'] as const) {
      const sample = leadsToRescue.find((l) => l.group === group);
      if (sample) {
        console.log(`--- GRUPO ${group} (${leadsToRescue.filter((l) => l.group === group).length} leads) ---`);
        console.log(selectRescueTemplate(sample));
        console.log('---\n');
      }
    }

    const estSeconds = leadsToRescue.length * 2;
    const estCost = (leadsToRescue.length * 0.005).toFixed(2);
    console.log(`\nEstimación producción: ~${estSeconds}s (${leadsToRescue.length} × 2s delay)`);
    console.log(`Costo Twilio estimado: ~$${estCost} USD`);
    console.log('\n⚠️  DRY-RUN: No se enviaron mensajes.');
    console.log('Para enviar: DRY_RUN=false npx tsx scripts/rescue-lost-leads-21jun.ts');
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!accountSid || !authToken || !url || !key) {
    throw new Error('Missing TWILIO or Supabase env vars');
  }

  const twilioClient = twilio(accountSid, authToken);
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results = { success: 0, failed: 0, errors: [] as string[] };

  for (const lead of leadsToRescue) {
    const result = await rescueLead(lead, twilioClient, supabase);
    if (result.success) results.success++;
    else {
      results.failed++;
      results.errors.push(`${lead.phone}: ${result.error}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  await sendTelegramAlert(
    `🚑 Rescate outage 21-jun completado\n\n` +
      `✅ Enviados: ${results.success}\n` +
      `❌ Fallidos: ${results.failed}\n` +
      `📊 Total: ${leadsToRescue.length}\n\n` +
      `Revisar respuestas en /admin/conversations`,
  );

  console.log(`\n✅ Done: ${results.success} sent, ${results.failed} failed`);
  if (results.errors.length > 0) {
    console.log('\nErrores:');
    for (const e of results.errors) console.log(`  - ${e}`);
  }
}

main().catch((err) => {
  console.error('FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
