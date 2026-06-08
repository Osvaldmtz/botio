import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { enrichLead, enrichAndNotifyLead, type ConversationMessage } from '../lib/lead-enrichment';
import { notifyHotLeadIfNew, notifyHotLeadFromConversation } from '../lib/hot-lead-notifier';

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

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

loadEnvLocal();

process.env.TELEGRAM_BOT_TOKEN ??= 'test-token';
process.env.TELEGRAM_ADMIN_CHAT_ID ??= 'test-chat';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const botId = process.env.KALYO_BOT_ID ?? '64f6eed2-1522-48fe-a2c6-f858b767df06';

if (!url || !key) {
  console.error('Missing Supabase env');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const testPhone = `+5299905${String(Date.now()).slice(-5)}`;
const telegramSent: string[] = [];

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (target.includes('api.telegram.org') && init?.body) {
    try {
      const body = JSON.parse(String(init.body)) as { text?: string };
      if (body.text) telegramSent.push(body.text);
    } catch {
      // ignore
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  return originalFetch(input, init);
};

async function cleanup(conversationId?: string): Promise<void> {
  if (conversationId) {
    await supabase.from('hot_lead_alert_queue').delete().eq('conversation_id', conversationId);
  }
  const { data: convs } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_phone', testPhone);
  const ids = (convs ?? []).map((c) => c.id);
  if (ids.length) {
    await supabase.from('hot_lead_alert_queue').delete().in('conversation_id', ids);
    await supabase.from('messages').delete().in('conversation_id', ids);
    await supabase.from('conversations').delete().in('id', ids);
  }
}

async function ensureConversation(channel: 'whatsapp' | 'webchat' = 'whatsapp'): Promise<string> {
  const row =
    channel === 'webchat'
      ? {
          bot_id: botId,
          customer_phone: `webchat:${testPhone}`,
          channel: 'webchat',
          session_id: `sess-${Date.now()}`,
          lead_score: 50,
        }
      : {
          bot_id: botId,
          customer_phone: testPhone,
          channel: 'whatsapp',
          lead_score: 50,
        };

  const { data, error } = await supabase
    .from('conversations')
    .upsert(row, { onConflict: 'bot_id,customer_phone' })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('conversation failed');
  return data.id as string;
}

async function main(): Promise<void> {
  console.log('[test] hot lead telegram alert E2E\n');
  await cleanup();

  const conversationId = await ensureConversation('whatsapp');
  console.log(`[test] conversation ${conversationId}`);

  const warmMessages: ConversationMessage[] = [
    {
      role: 'user',
      content: 'Hola, me interesa conocer Kalyo',
      created_at: new Date().toISOString(),
    },
  ];

  const warm = enrichLead({
    phone: testPhone,
    conversationMessages: warmMessages,
  });
  assert(warm.score < 70, `warm score should be <70, got ${warm.score}`);

  const hotMessages: ConversationMessage[] = [
    ...warmMessages,
    {
      role: 'user',
      content:
        'Soy psicólogo con 10 pacientes, cuánto cuesta? Quiero pagar hoy mismo, es urgente',
      created_at: new Date().toISOString(),
    },
  ];

  const hot = enrichLead({
    phone: testPhone,
    conversationMessages: hotMessages,
    email: 'hot-test@example.com',
    name: 'Roberto Test',
  });
  assert(hot.score >= 70, `hot score should be >=70, got ${hot.score}`);
  console.log(`[test] score transition ${warm.score} → ${hot.score}`);

  telegramSent.length = 0;
  await enrichAndNotifyLead(supabase, {
    conversationId,
    phone: testPhone,
    conversationMessages: hotMessages,
    email: 'hot-test@example.com',
    name: 'Roberto Test',
  });

  assert(telegramSent.length === 1, 'first alert should send exactly one Telegram message');
  assert(telegramSent[0].includes('HOT LEAD detectado'), 'message should include HOT LEAD header');
  assert(telegramSent[0].includes('Roberto Test'), 'message should include name');
  assert(telegramSent[0].includes(`${hot.score}/100`), 'message should include score');
  assert(telegramSent[0].includes(conversationId), 'message should include conversation link');
  console.log('[test] first alert OK');

  telegramSent.length = 0;
  await enrichAndNotifyLead(supabase, {
    conversationId,
    phone: testPhone,
    conversationMessages: hotMessages,
    email: 'hot-test@example.com',
    name: 'Roberto Test',
  });
  assert(telegramSent.length === 0, 'second call should NOT duplicate alert');
  console.log('[test] idempotency OK');

  const webchatId = await ensureConversation('webchat');
  await supabase
    .from('conversations')
    .update({ lead_score: 50, lead_signals: [], lead_temperature: 'warm' })
    .eq('id', webchatId);

  telegramSent.length = 0;
  const webchatResult = await notifyHotLeadIfNew({
    supabase,
    conversation: {
      id: webchatId,
      customer_phone: `webchat:${testPhone}`,
      channel: 'webchat',
      session_id: `sess-${Date.now()}`,
      lead_signals: [],
    },
    enrichment: hot,
    previousScore: 50,
    messages: hotMessages,
    name: 'Webchat Lead',
    email: 'webchat@example.com',
  });
  assert(webchatResult.sent === true, 'webchat channel should trigger alert');
  assert(telegramSent[0].includes('Webchat'), 'webchat contact label expected');
  console.log('[test] webchat channel OK');

  telegramSent.length = 0;
  const dbResult = await notifyHotLeadFromConversation(supabase, conversationId, { force: true });
  assert(dbResult.sent === true, 'notifyHotLeadFromConversation should send with force');
  assert(telegramSent[0].includes('HOT LEAD detectado'), 'DB path message format OK');
  console.log('[test] DB/manual path OK');

  await cleanup(conversationId);
  await cleanup(webchatId);
  console.log('[test] ALL PASSED');
}

main().catch((err) => {
  console.error('[test] FAILED', err);
  process.exit(1);
});
