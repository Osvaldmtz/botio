import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { matchObjectionPattern, detectObjection } from '../lib/objection-detector';

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

const testPhone = `+5299903${String(Date.now()).slice(-5)}`;

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
  console.log('Objection detector tests\n');

  const cases: Array<{ msg: string; type: string }> = [
    { msg: 'es muy caro', type: 'price' },
    { msg: 'Sigue siendo caro para mí', type: 'price' },
    { msg: '29 dólares son muchos para mí', type: 'price' },
    { msg: 'déjame pensarlo', type: 'thinking' },
    { msg: 'ya tengo doctoralia', type: 'competition' },
    { msg: 'uso un Excel', type: 'competition' },
    { msg: 'ahorita no tengo tiempo', type: 'no_time' },
    { msg: 'no creo que me sirva', type: 'not_useful' },
    { msg: 'apenas estoy empezando', type: 'few_patients' },
  ];

  for (const c of cases) {
    const m = matchObjectionPattern(c.msg);
    assert(m?.type === c.type, `${c.msg} → ${c.type}, got ${m?.type}`);
    assert(m?.confidence === 'high' || m?.confidence === 'medium', `${c.msg} confidence`);
  }

  assert(matchObjectionPattern('mensaje neutral cualquiera') === null, 'neutral → null');

  await cleanup();
  const conversationId = await ensureConversation();

  const first = await detectObjection('es muy caro', { id: conversationId, customer_phone: testPhone }, supabase);
  assert(first?.type === 'price' && first.is_repeat === false, 'first price not repeat');

  await supabase.from('detected_objections').insert({
    conversation_id: conversationId,
    customer_phone: testPhone,
    objection_type: 'price',
    trigger_message: 'es caro',
    response_used: 'respuesta test',
    outcome: 'pending',
  });

  const second = await detectObjection('es muy caro', { id: conversationId, customer_phone: testPhone }, supabase);
  assert(second?.is_repeat === true, 'second price is repeat');

  await cleanup(conversationId);
  console.log('✓ All objection detector tests passed');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
