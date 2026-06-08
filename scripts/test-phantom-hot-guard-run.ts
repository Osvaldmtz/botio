import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { enrichAndNotifyLead, type ConversationMessage } from '../lib/lead-enrichment';

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

const testPhone = `+52999999${String(Date.now()).slice(-4)}`;
let conversationId = '';

async function cleanup(): Promise<void> {
  if (!conversationId) return;
  await supabase.from('hot_lead_alert_queue').delete().eq('conversation_id', conversationId);
  await supabase.from('messages').delete().eq('conversation_id', conversationId);
  await supabase.from('conversations').delete().eq('id', conversationId);
}

async function main(): Promise<void> {
  console.log('[test] phantom HOT guard\n');

  conversationId = randomUUID();
  const { error: insertError } = await supabase.from('conversations').insert({
    id: conversationId,
    bot_id: botId,
    customer_phone: testPhone,
    channel: 'whatsapp',
    metadata: { test: true },
  });
  if (insertError) throw insertError;

  const hotMessages: ConversationMessage[] = [
    {
      role: 'user',
      content: 'Soy psicólogo con 10 pacientes, cuánto cuesta? urgente',
      created_at: new Date().toISOString(),
    },
  ];

  const env = process.env as Record<string, string | undefined>;
  const previousEnv = env.NODE_ENV;
  env.NODE_ENV = 'production';

  try {
    await enrichAndNotifyLead(supabase, {
      conversationId,
      phone: testPhone,
      conversationMessages: hotMessages,
      email: 'phantom-guard@test.local',
    });

    const { data: conv } = await supabase
      .from('conversations')
      .select('lead_score, lead_signals')
      .eq('id', conversationId)
      .single();

    assert(
      !conv || conv.lead_score === null || conv.lead_score < 70,
      'production guard should not persist HOT score',
    );
    console.log('[test] production guard blocked persist OK');
  } finally {
    env.NODE_ENV = previousEnv;
  }

  console.log('[test] ALL PASSED');
}

void main()
  .catch((err) => {
    console.error('[test] FAILED', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
