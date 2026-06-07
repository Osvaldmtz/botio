import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  formatDay1,
  formatDay3,
  formatOnboardingMessage,
} from '../lib/trial-onboarding-messages';
import { buildTrialOnboardingTelegramText } from '../lib/trial-onboarding-notifications';
import {
  fetchPendingOnboardingDay,
  runTrialOnboardingCron,
} from '../lib/trial-onboarding-cron';
import {
  handleTrialOnboardingMessage,
  isUnsubscribeMessage,
} from '../lib/trial-onboarding-interceptor';

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

const testPhone = `+5299902${String(Date.now()).slice(-5)}`;
const testEmail = `onboarding-test-${Date.now()}@example.com`;
const sentWhatsApp: string[] = [];
const sentTelegram: string[] = [];

async function cleanup(): Promise<void> {
  await supabase.from('trial_onboarding_messages').delete().eq('customer_phone', testPhone);
  await supabase.from('trial_onboarding_messages').delete().ilike('trial_user_email', '%onboarding-test-%');
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

async function insertOnboarding(params: {
  conversationId: string;
  startedAt: Date;
  day13Sent?: boolean;
}): Promise<string> {
  const endsAt = new Date(params.startedAt.getTime() + 15 * 24 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from('trial_onboarding_messages')
    .insert({
      customer_phone: testPhone,
      trial_user_email: testEmail,
      trial_user_name: 'Onboarding Test',
      trial_started_at: params.startedAt.toISOString(),
      trial_ends_at: endsAt.toISOString(),
      conversation_id: params.conversationId,
      day_13_sent_at: params.day13Sent ? new Date().toISOString() : null,
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('insert onboarding failed');
  return data.id as string;
}

async function runTests(): Promise<void> {
  console.log('Trial onboarding tests\n');
  await cleanup();

  const user = { trial_user_name: 'María Test', trial_user_email: testEmail };
  assert(formatDay1(user).includes('María Test'), 'day1 includes name');
  assert(formatDay3(user).includes('Asistente de voz'), 'day3 template');
  assert(
    buildTrialOnboardingTelegramText({ day: 1, name: 'María Test', email: testEmail, daysLeft: 14 }).includes(
      'Onboarding Día 1',
    ),
    'telegram template',
  );
  assert(isUnsubscribeMessage('stop por favor'), 'unsubscribe detect');

  const conversationId = await ensureConversation();
  const mockCreds = { accountSid: 'ACtest', authToken: 'test', from: 'whatsapp:+10000000000' };

  const day1Start = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const row1Id = await insertOnboarding({ conversationId, startedAt: day1Start });

  const pending1 = await fetchPendingOnboardingDay(supabase, 1);
  assert(pending1.some((r) => r.id === row1Id), 'day1 pending window');

  sentWhatsApp.length = 0;
  sentTelegram.length = 0;
  const cron1 = await runTrialOnboardingCron({
    supabase,
    creds: mockCreds,
    sendFn: async (args) => {
      sentWhatsApp.push(args.body);
    },
    sendTelegram: async (text) => {
      sentTelegram.push(text);
    },
  });
  assert((cron1.sent_day1 ?? 0) >= 1, 'day1 sent');
  assert(sentWhatsApp.some((b) => b.includes('Onboarding Test')), 'whatsapp has name');
  assert(sentTelegram.length >= 1, 'telegram notified');

  const { data: after1 } = await supabase
    .from('trial_onboarding_messages')
    .select('day_1_sent_at')
    .eq('id', row1Id)
    .single();
  assert(after1?.day_1_sent_at != null, 'day_1_sent_at set');

  sentWhatsApp.length = 0;
  const cron1Again = await runTrialOnboardingCron({
    supabase,
    creds: mockCreds,
    sendFn: async (args) => {
      sentWhatsApp.push(args.body);
    },
  });
  assert(sentWhatsApp.length === 0, 'day1 idempotent');
  assert((cron1Again.sent_day1 ?? 0) === 0, 'no second day1');

  await supabase.from('trial_onboarding_messages').delete().eq('id', row1Id);

  const day3Start = new Date(Date.now() - 72 * 60 * 60 * 1000);
  const row3Id = await insertOnboarding({ conversationId, startedAt: day3Start });
  const pending3 = await fetchPendingOnboardingDay(supabase, 3);
  assert(pending3.some((r) => r.id === row3Id), 'day3 pending');

  sentWhatsApp.length = 0;
  const cron3 = await runTrialOnboardingCron({
    supabase,
    creds: mockCreds,
    sendFn: async (args) => {
      sentWhatsApp.push(args.body);
    },
  });
  assert((cron3.sent_day3 ?? 0) >= 1, 'day3 sent');
  assert(
    formatOnboardingMessage(3, user, new Date(Date.now() + 10 * 86400000).toISOString()).includes('María Test'),
    'format day3 name',
  );

  await supabase.from('trial_onboarding_messages').delete().eq('id', row3Id);

  const unsubRowId = await insertOnboarding({ conversationId, startedAt: day1Start });
  const unsub = await handleTrialOnboardingMessage({
    supabase,
    conversationId,
    customerPhone: testPhone,
    messageBody: 'stop',
    creds: null,
  });
  assert(unsub?.action === 'unsubscribed', 'unsubscribe handled');
  const { data: unsubData } = await supabase
    .from('trial_onboarding_messages')
    .select('unsubscribed')
    .eq('id', unsubRowId)
    .single();
  assert(unsubData?.unsubscribed === true, 'unsubscribed flag');

  await supabase.from('trial_onboarding_messages').delete().eq('id', unsubRowId);

  const failRowId = await insertOnboarding({ conversationId, startedAt: day1Start });
  const cronFail = await runTrialOnboardingCron({
    supabase,
    creds: mockCreds,
    sendFn: async (args) => {
      sentWhatsApp.push(args.body);
    },
    sendTelegram: async () => {
      throw new Error('telegram down');
    },
  });
  assert((cronFail.sent_day1 ?? 0) >= 1, 'whatsapp ok when telegram fails');
  const { data: failData } = await supabase
    .from('trial_onboarding_messages')
    .select('day_1_sent_at')
    .eq('id', failRowId)
    .single();
  assert(failData?.day_1_sent_at != null, 'sent_at set despite telegram fail');
  await supabase.from('trial_onboarding_messages').delete().eq('id', failRowId);

  await cleanup();
  console.log('✓ All trial onboarding tests passed');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
