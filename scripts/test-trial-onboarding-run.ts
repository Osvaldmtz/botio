import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  formatDay2,
  formatDay3,
  formatOnboardingMessage,
} from '../lib/trial-onboarding-messages';
import { buildTrialOnboardingTelegramText } from '../lib/trial-onboarding-notifications';
import {
  fetchPendingOnboardingDay,
  markDay1WelcomeSent,
  runTrialOnboardingCron,
} from '../lib/trial-onboarding-cron';
import {
  handleTrialOnboardingMessage,
  isUnsubscribeMessage,
} from '../lib/trial-onboarding-interceptor';
import { KALYO_TRIAL_MS } from '../lib/kalyo-trial-plans';

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
  day15Sent?: boolean;
}): Promise<string> {
  const endsAt = new Date(params.startedAt.getTime() + KALYO_TRIAL_MS);
  const { data, error } = await supabase
    .from('trial_onboarding_messages')
    .insert({
      customer_phone: testPhone,
      trial_user_email: testEmail,
      trial_user_name: 'Onboarding Test',
      trial_started_at: params.startedAt.toISOString(),
      trial_ends_at: endsAt.toISOString(),
      conversation_id: params.conversationId,
      day_15_sent_at: params.day15Sent ? new Date().toISOString() : null,
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('insert onboarding failed');
  return data.id as string;
}

async function runTests(): Promise<void> {
  console.log('Trial onboarding integration tests\n');
  await cleanup();

  const user = { trial_user_name: 'María Test', trial_user_email: testEmail };
  assert(formatDay2(user).includes('María Test'), 'day2 includes name');
  assert(formatDay3(user).includes('PHQ-9'), 'day3 evaluations');
  assert(
    buildTrialOnboardingTelegramText({ day: 2, name: 'María Test', email: testEmail, daysLeft: 5 }).includes(
      'Onboarding Día 2',
    ),
    'telegram template',
  );
  assert(isUnsubscribeMessage('stop por favor'), 'unsubscribe detect');

  const conversationId = await ensureConversation();
  const mockCreds = { accountSid: 'ACtest', authToken: 'test', from: 'whatsapp:+10000000000' };

  const day2Start = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const row2Id = await insertOnboarding({ conversationId, startedAt: day2Start });
  await markDay1WelcomeSent(supabase, row2Id);

  const pending2 = await fetchPendingOnboardingDay(supabase, 2);
  assert(pending2.some((r) => r.id === row2Id), 'day2 pending window');

  sentWhatsApp.length = 0;
  sentTelegram.length = 0;
  const cron2 = await runTrialOnboardingCron({
    supabase,
    creds: mockCreds,
    sendFn: async (args) => {
      sentWhatsApp.push(args.body);
    },
    sendTelegram: async (text) => {
      sentTelegram.push(text);
    },
  });
  assert((cron2.sent_day2 ?? 0) >= 1, 'day2 sent');
  assert(sentWhatsApp.some((b) => b.includes('Onboarding Test')), 'whatsapp has name');
  assert(sentTelegram.length >= 1, 'telegram notified');

  const { data: after2 } = await supabase
    .from('trial_onboarding_messages')
    .select('day_2_sent_at')
    .eq('id', row2Id)
    .single();
  assert(after2?.day_2_sent_at != null, 'day_2_sent_at set');

  sentWhatsApp.length = 0;
  const cron2Again = await runTrialOnboardingCron({
    supabase,
    creds: mockCreds,
    sendFn: async (args) => {
      sentWhatsApp.push(args.body);
    },
  });
  assert(sentWhatsApp.length === 0, 'day2 idempotent');
  assert((cron2Again.sent_day2 ?? 0) === 0, 'no second day2');

  await supabase.from('trial_onboarding_messages').delete().eq('id', row2Id);

  const day3Start = new Date(Date.now() - 72 * 60 * 60 * 1000);
  const row3Id = await insertOnboarding({ conversationId, startedAt: day3Start });
  await markDay1WelcomeSent(supabase, row3Id);
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

  const unsubRowId = await insertOnboarding({ conversationId, startedAt: day2Start });
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

  const failRowId = await insertOnboarding({ conversationId, startedAt: day2Start });
  await markDay1WelcomeSent(supabase, failRowId);
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
  assert((cronFail.sent_day2 ?? 0) >= 1, 'whatsapp ok when telegram fails');
  const { data: failData } = await supabase
    .from('trial_onboarding_messages')
    .select('day_2_sent_at')
    .eq('id', failRowId)
    .single();
  assert(failData?.day_2_sent_at != null, 'sent_at set despite telegram fail');
  await supabase.from('trial_onboarding_messages').delete().eq('id', failRowId);

  await cleanup();
  console.log('✓ All trial onboarding integration tests passed');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
