import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { handleObjectionMessage } from '../lib/objection-interceptor';
import { getPaymentLink } from '../lib/kalyo-payment-links';

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

const testPhone = `+5299904${String(Date.now()).slice(-5)}`;
const testEmail = `objection-flow-${Date.now()}@example.com`;
const telegramSent: string[] = [];

async function cleanup(conversationId?: string): Promise<void> {
  if (conversationId) {
    await supabase.from('detected_objections').delete().eq('conversation_id', conversationId);
  }
  await supabase.from('detected_objections').delete().eq('customer_phone', testPhone);
  const { data: convs } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_phone', testPhone);
  const ids = (convs ?? []).map((c) => c.id);
  if (ids.length) {
    await supabase.from('messages').delete().in('conversation_id', ids);
    await supabase.from('conversations').delete().in('id', ids);
  }
}

async function ensureConversation(): Promise<string> {
  const { data, error } = await supabase
    .from('conversations')
    .upsert(
      { bot_id: botId, customer_phone: testPhone, channel: 'whatsapp' },
      { onConflict: 'bot_id,customer_phone' },
    )
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('conversation failed');
  return data.id as string;
}

async function runTests(): Promise<void> {
  console.log('Objection flow tests\n');
  await cleanup();

  const conversationId = await ensureConversation();
  const proCoupon = getPaymentLink('pro', 'PRIMER50');

  const first = await handleObjectionMessage({
    supabase,
    conversationId,
    customerPhone: testPhone,
    messageBody: 'es muy caro',
    metadata: { name: 'María Test', email: testEmail },
  });

  assert(first != null && first.objectionType === 'price', 'first objection type price');
  assert(first != null && first.replyText.includes(proCoupon), 'first response includes PRIMER50 link');
  assert(first != null && first.replyText.includes('20 evaluaciones'), 'first response has official Starter eval count');
  assert(first != null && first.replyText.includes('2 pacientes activos'), 'first response has official Starter patients');
  assert(first != null && first.isRepeat === false, 'first not repeat');

  const { data: row1 } = await supabase
    .from('detected_objections')
    .select('id, outcome')
    .eq('conversation_id', conversationId)
    .eq('objection_type', 'price')
    .maybeSingle();
  assert(row1 != null, 'detected_objections row created');
  assert(row1?.outcome === 'pending', 'first outcome pending');

  const second = await handleObjectionMessage({
    supabase,
    conversationId,
    customerPhone: testPhone,
    messageBody: 'Sigue siendo caro para mí',
    metadata: { name: 'María Test', email: testEmail },
  });

  assert(second != null && second.isRepeat === true, 'second is repeat');
  assert(second != null && second.replyText.includes('Osvaldo'), 'insistence mentions handoff');
  assert(second != null && second.replyText.includes('email'), 'insistence asks for email');

  const { count } = await supabase
    .from('detected_objections')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('objection_type', 'price')
    .eq('outcome', 'handoff');
  assert((count ?? 0) >= 1, 'handoff outcome on insistence');

  const { notifyObjectionTelegram } = await import('../lib/objection-notifications');
  telegramSent.length = 0;
  await notifyObjectionTelegram({
    kind: 'price_insistence',
    name: 'María Test',
    email: testEmail,
    triggerMessage: 'sigue caro',
    sendTelegram: async (text) => {
      telegramSent.push(text);
    },
  });
  assert(telegramSent.some((t) => t.includes('INSISTE en precio')), 'telegram price alert');

  await cleanup(conversationId);
  console.log('✓ All objection flow tests passed');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
