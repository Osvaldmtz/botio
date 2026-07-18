/**
 * Diagnóstico — leads perdidos durante silencio 20-21 jun.
 * NO envía mensajes. Solo reporte Twilio × Botio BD.
 */
// @ts-nocheck — one-off script, not part of app runtime
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import {
  classifyTemplateGroup,
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

const WINDOW = {
  label: '20 jun 23:24 MX → 21 jun 19:30 MX',
  afterUtc: '2026-06-21T05:24:00.000Z',
  beforeUtc: '2026-06-22T01:30:00.000Z',
};

const BOT_NUMBER = '+15559374917';

function normalizePhone(from: string): string {
  const raw = from.replace(/^whatsapp:/i, '').trim();
  let digits = raw.replace(/\D/g, '');

  // Mexico mobile: +521XXXXXXXXXX → +52XXXXXXXXXX (10 digits after country code)
  if (digits.startsWith('521') && digits.length === 13) {
    digits = '52' + digits.slice(3);
  } else if (digits.startsWith('52') && digits.length === 12) {
    // already normalized MX
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  } else if (digits.length === 10) {
    return `+1${digits}`;
  }

  return digits.startsWith('52') || digits.startsWith('57') || digits.startsWith('1')
    ? `+${digits}`
    : raw.startsWith('+')
      ? raw
      : `+${digits}`;
}

function phonesMatch(a: string, b: string): boolean {
  return normalizePhone(a) === normalizePhone(b);
}

type InboundMsg = {
  sid: string;
  from: string;
  phone: string;
  body: string;
  dateSent: Date;
};

async function fetchTwilioInbound(): Promise<InboundMsg[]> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  }

  const client = twilio(accountSid, authToken);
  const after = new Date(WINDOW.afterUtc);
  const before = new Date(WINDOW.beforeUtc);

  const all: InboundMsg[] = [];
  const messages = await client.messages.list({
    to: `whatsapp:${BOT_NUMBER}`,
    dateSentAfter: after,
    dateSentBefore: before,
    limit: 1000,
  });

  for (const msg of messages) {
    if (msg.direction !== 'inbound') continue;
    all.push({
      sid: msg.sid,
      from: msg.from ?? '',
      phone: normalizePhone(msg.from ?? ''),
      body: msg.body ?? '',
      dateSent: msg.dateSent ?? new Date(msg.dateCreated),
    });
  }

  all.sort((a, b) => a.dateSent.getTime() - b.dateSent.getTime());
  return all;
}

type ConvRow = {
  id: string;
  customer_phone: string;
  created_at: string;
  last_message_at: string | null;
  msg_count: number;
  has_assistant_reply: boolean;
  first_user_msg: string | null;
  last_assistant_at: string | null;
};

async function fetchConversations(
  supabase: ReturnType<typeof createClient>,
  phones: string[],
): Promise<Map<string, ConvRow[]>> {
  const map = new Map<string, ConvRow[]>();
  if (phones.length === 0) return map;

  const variants = new Set<string>();
  for (const p of phones) {
    variants.add(p);
    variants.add(p.replace(/^\+521/, '+52'));
    variants.add(p.replace(/^\+52(\d{10})$/, '+521$1'));
    variants.add(p.replace(/^\+/, ''));
    variants.add(`whatsapp:${p}`);
  }

  const { data: allConvs, error: allErr } = await supabase
    .from('conversations')
    .select('id, customer_phone, created_at, last_message_at');

  if (allErr) throw new Error(`conversations query: ${allErr.message}`);

  const convs = (allConvs ?? []).filter((c) =>
    c.customer_phone != null && phones.some((p) => phonesMatch(p, c.customer_phone)),
  );

  for (const conv of convs ?? []) {
    const phone = normalizePhone(conv.customer_phone);

    const { count: msgCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conv.id);

    const { data: assistantMsgs } = await supabase
      .from('messages')
      .select('created_at')
      .eq('conversation_id', conv.id)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: firstUser } = await supabase
      .from('messages')
      .select('content, created_at')
      .eq('conversation_id', conv.id)
      .eq('role', 'user')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const row: ConvRow = {
      id: conv.id,
      customer_phone: conv.customer_phone,
      created_at: conv.created_at,
      last_message_at: conv.last_message_at,
      msg_count: msgCount ?? 0,
      has_assistant_reply: (assistantMsgs?.length ?? 0) > 0,
      first_user_msg: firstUser?.content ?? null,
      last_assistant_at: assistantMsgs?.[0]?.created_at ?? null,
    };

    const existing = map.get(phone) ?? [];
    existing.push(row);
    map.set(phone, existing);
  }

  return map;
}

function formatMx(iso: Date): string {
  return iso.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('DIAGNÓSTICO LEADS PERDIDOS — Silencio 20-21 jun');
  console.log(`Ventana: ${WINDOW.label}`);
  console.log(`UTC: ${WINDOW.afterUtc} → ${WINDOW.beforeUtc}`);
  console.log('═══════════════════════════════════════════════════\n');

  const inbound = await fetchTwilioInbound();

  console.log('── PASO 1: Twilio inbound ──');
  console.log(`Total mensajes inbound: ${inbound.length}`);
  const byPhone = new Map<string, InboundMsg[]>();
  for (const m of inbound) {
    const list = byPhone.get(m.phone) ?? [];
    list.push(m);
    byPhone.set(m.phone, list);
  }
  console.log(`Números únicos: ${byPhone.size}\n`);

  if (inbound.length > 0) {
    console.log('Contenidos (cronológico):');
    for (const m of inbound) {
      const preview = m.body.replace(/\n/g, ' ').slice(0, 80);
      console.log(`  ${formatMx(m.dateSent)} MX | ${m.phone} | "${preview}"`);
    }
    console.log('');
  } else {
    console.log('⚠️  Cero mensajes inbound en Twilio para esta ventana.\n');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const phones = Array.from(byPhone.keys());
  const convMap = await fetchConversations(supabase, phones);

  console.log('── PASO 2-3: Cruce BD + Lista priorizada ──\n');

  type LeadRow = {
    category: 'PERDIDO' | 'A_MEDIAS' | 'OK';
    phone: string;
    firstMsg: string;
    timeMx: string;
    recoverable: string;
    detail: string;
  };

  const rows: LeadRow[] = [];

  for (const [phone, msgs] of byPhone) {
    const first = msgs[0];
    const firstInboundAt = first.dateSent;
    const convs = convMap.get(phone) ?? [];
    const anyConv = convs.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];

    let category: LeadRow['category'];
    let detail: string;
    let recoverable: string;

    if (!anyConv) {
      category = 'PERDIDO';
      detail = 'Twilio recibió msg, sin conversación en BD';
      recoverable = 'Sí';
    } else {
      const lastBot = anyConv.last_assistant_at
        ? new Date(anyConv.last_assistant_at)
        : null;
      const botRepliedAfterInbound = lastBot && lastBot >= firstInboundAt;

      if (!anyConv.has_assistant_reply || !botRepliedAfterInbound) {
        category = 'A_MEDIAS';
        detail = `Conv ${anyConv.id.slice(0, 8)}… — último bot ${lastBot ? formatMx(lastBot) : 'nunca'}, inbound ${formatMx(firstInboundAt)}`;
        recoverable = 'Sí';
      } else {
        category = 'OK';
        detail = `Conv ${anyConv.id.slice(0, 8)}… bot respondió tras inbound (${formatMx(lastBot!)})`;
        recoverable = 'N/A';
      }
    }

    rows.push({
      category,
      phone,
      firstMsg: first.body.replace(/\n/g, ' ').slice(0, 60),
      timeMx: formatMx(first.dateSent),
      recoverable,
      detail,
    });
  }

  rows.sort((a, b) => {
    const order = { PERDIDO: 0, A_MEDIAS: 1, OK: 2 };
    return order[a.category] - order[b.category];
  });

  const perdidos = rows.filter((r) => r.category === 'PERDIDO');
  const aMedias = rows.filter((r) => r.category === 'A_MEDIAS');
  const ok = rows.filter((r) => r.category === 'OK');

  console.log('| Categoría | Phone | Primer msg | Hora MX | Recuperable? |');
  console.log('|-----------|-------|------------|---------|--------------|');
  for (const r of rows) {
    console.log(
      `| ${r.category.padEnd(9)} | ${r.phone} | "${r.firstMsg}" | ${r.timeMx} | ${r.recoverable} |`,
    );
    console.log(`|           |       | ${r.detail}`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('RESUMEN');
  console.log('═══════════════════════════════════════════════════');
  console.log(`A) Mensajes Twilio inbound en ventana: ${inbound.length}`);
  console.log(`B) Leads PERDIDOS (no en BD): ${perdidos.length}`);
  console.log(`C) Leads A MEDIAS (sin respuesta bot): ${aMedias.length}`);
  console.log(`D) Conversaciones OK: ${ok.length}`);
  console.log(`   Números únicos inbound: ${byPhone.size}`);

  // Also check BD gap: user messages in silence window
  const { count: dbUserMsgs } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'user')
    .gte('created_at', WINDOW.afterUtc)
    .lte('created_at', WINDOW.beforeUtc);

  const { count: dbConvs } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', WINDOW.afterUtc)
    .lte('created_at', WINDOW.beforeUtc);

  console.log(`\nBD en ventana: ${dbUserMsgs ?? 0} user msgs, ${dbConvs ?? 0} conversaciones nuevas`);

  console.log('\n── PASO 4: Plantilla rescate (NO enviada) ──');
  console.log(`Para ${perdidos.length + aMedias.length} lead(s) recuperable(s):\n`);
  console.log(`"Hola! 👋 Soy Sofía de Kalyo.

Vi que me escribiste hace unas horas pero tuve un
problema técnico y no pude responderte en su momento.

Mil disculpas por la espera. ¿Sigues interesado/a en
conocer Kalyo? Te cuento todo lo que necesites.

(Te activo trial gratis de 7 días si quieres probar)"`);

  console.log('\n── PASO 5: Recomendación ──');
  const recoverable = perdidos.length + aMedias.length;
  if (recoverable === 0) {
    console.log('No hay leads que rescatar — Twilio tampoco recibió inbound en la ventana.');
    console.log('El silencio fue probablemente tráfico cero real, no leads perdidos.');
  } else if (recoverable <= 3) {
    console.log('OPCIÓN A (manual): pocos leads — Osvaldo puede mandar 1:1 desde WhatsApp.');
  } else {
    console.log('OPCIÓN B (automatizado): script rescue-lost-leads-21jun.ts recomendado.');
  }
  console.log('\n⚠️  NO se enviaron mensajes. Esperando decisión de Osvaldo.');

  if (process.argv.includes('--export')) {
    const exportLeads: LostLeadRecord[] = [];
    for (const [phone, msgs] of byPhone) {
      const row = rows.find((r) => r.phone === phone);
      if (!row || row.category === 'OK') continue;

      const bodies = msgs.map((m) => m.body);
      const emailMsg = bodies.find((b) => b.includes('@'));

      exportLeads.push({
        phone,
        category: row.category as 'PERDIDO' | 'A_MEDIAS',
        group: classifyTemplateGroup(phone, bodies),
        firstMsg: row.firstMsg,
        firstInboundAt: msgs[0].dateSent.toISOString(),
        ...(phone === '+573215005921'
          ? { name: 'Luis Alberto', email: emailMsg ?? 'alvarezramirez1960@gmail.com' }
          : emailMsg
            ? { email: emailMsg }
            : {}),
      });
    }

    exportLeads.sort((a, b) => a.group.localeCompare(b.group) || a.phone.localeCompare(b.phone));

    const outPath = join(process.cwd(), 'lib/lost-leads-21jun.json');
    writeFileSync(outPath, JSON.stringify(exportLeads, null, 2) + '\n');
    console.log(`\n📁 Exportado ${exportLeads.length} leads → ${outPath}`);
  }
}

main().catch((err) => {
  console.error('FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
