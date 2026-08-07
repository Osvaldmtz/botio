/**
 * Isolated integration test for trial onboarding day 9.
 * Uses only @test.kalyo.io seed rows — never calls runTrialOnboardingCron.
 *
 * Run: npx tsx scripts/test-trial-onboarding-day9-run.ts
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const TEST_EMAIL_DOMAIN = '@test.kalyo.io';

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve('server-only');
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeModule;

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

function assertTestEmail(email: string): void {
  assert(
    email.endsWith(TEST_EMAIL_DOMAIN),
    `Refusing to mutate non-test email: ${email}`,
  );
}

function testEmail(suffix: string): string {
  return `day9-${suffix}-${Date.now()}${TEST_EMAIL_DOMAIN}`;
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

const ROW_SELECT =
  'id, customer_phone, trial_user_email, trial_user_name, trial_started_at, trial_ends_at, conversation_id, unsubscribed, upgraded_to_paid_at, day_1_sent_at, day_2_sent_at, day_3_sent_at, day_7_sent_at, day_13_sent_at, day_15_sent_at, day_8_sent_at, day_9_sent_at, day_9_status';

async function cleanupAllTestRows(): Promise<void> {
  const { data: testRows } = await supabase
    .from('trial_onboarding_messages')
    .select('id, customer_phone, conversation_id')
    .ilike('trial_user_email', `%${TEST_EMAIL_DOMAIN}`);

  const rowIds = (testRows ?? []).map((r) => r.id as string);
  const phones = [...new Set((testRows ?? []).map((r) => r.customer_phone as string))];
  const convIds = [
    ...new Set(
      (testRows ?? [])
        .map((r) => r.conversation_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (rowIds.length) {
    await supabase.from('trial_onboarding_messages').delete().in('id', rowIds);
  }

  if (convIds.length) {
    await supabase.from('messages').delete().in('conversation_id', convIds);
  }

  for (const phone of phones) {
    await supabase.from('conversations').delete().eq('customer_phone', phone);
  }

  // Legacy pollution from earlier runs using @example.com
  await supabase
    .from('trial_onboarding_messages')
    .delete()
    .ilike('trial_user_email', 'day9-test-%@example.com');
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

async function insertExpiredTrial(params: {
  conversationId: string;
  email: string;
  trialMs: number;
}): Promise<string> {
  assertTestEmail(params.email);

  const startedAt = new Date(Date.now() - 216 * 60 * 60 * 1000);
  const endsAt = new Date(startedAt.getTime() + params.trialMs);
  const { data, error } = await supabase
    .from('trial_onboarding_messages')
    .insert({
      customer_phone: testPhone,
      trial_user_email: params.email,
      trial_user_name: 'Day9 Test',
      trial_started_at: startedAt.toISOString(),
      trial_ends_at: endsAt.toISOString(),
      conversation_id: params.conversationId,
      day_15_sent_at: new Date(startedAt.getTime() + 168 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('insert failed');
  return data.id as string;
}

async function fetchRowById(rowId: string) {
  const { data, error } = await supabase
    .from('trial_onboarding_messages')
    .select(ROW_SELECT)
    .eq('id', rowId)
    .single();
  if (error || !data) throw error ?? new Error(`row not found: ${rowId}`);
  assertTestEmail(data.trial_user_email as string);
  return data;
}

async function runTests(): Promise<void> {
  const { evaluateDay9Eligibility, hadPriorCouponOffer } = await import(
    '../lib/trial-onboarding-day9-eligibility'
  );
  const { fetchPendingOnboardingDay, processTrialOnboardingDay9Row } = await import(
    '../lib/trial-onboarding-cron'
  );
  const { KALYO_TRIAL_MS } = await import('../lib/kalyo-trial-plans');

  console.log('Trial onboarding day 9 tests (isolated @test.kalyo.io only)\n');
  await cleanupAllTestRows();

  const conversationId = await ensureConversation();
  const emailA = testEmail('coupon');
  const rowId = await insertExpiredTrial({
    conversationId,
    email: emailA,
    trialMs: KALYO_TRIAL_MS,
  });

  const pending9 = await fetchPendingOnboardingDay(supabase, 9);
  const testPending = pending9.filter((r) =>
    (r.trial_user_email as string).endsWith(TEST_EMAIL_DOMAIN),
  );
  assert(testPending.some((r) => r.id === rowId), 'day9 pending at 216h window');

  const eligibility = await evaluateDay9Eligibility(supabase, {
    trial_user_email: emailA,
    trial_ends_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    conversation_id: conversationId,
    unsubscribed: false,
    upgraded_to_paid_at: null,
    day_15_sent_at: new Date().toISOString(),
  });
  assert(eligibility.action === 'send_coupon', 'eligible for PRIMER50');

  const sentBodies: string[] = [];
  const mockCreds = { accountSid: 'ACtest', authToken: 'test', from: 'whatsapp:+10000000000' };
  const row = await fetchRowById(rowId);
  const result = await processTrialOnboardingDay9Row({
    supabase,
    row,
    creds: mockCreds,
    sendFn: async (args) => {
      sentBodies.push(args.body);
    },
    sendTelegram: async () => {},
  });
  assert(result === 'sent', 'day9 coupon sent for test row only');
  assert(sentBodies.some((b) => b.includes('PRIMER50')), 'body includes coupon');

  const hadCoupon = await hadPriorCouponOffer(supabase, {
    conversationId,
    email: emailA,
  });
  assert(hadCoupon, 'coupon history detected after send');

  const { data: afterCoupon } = await supabase
    .from('trial_onboarding_messages')
    .select('day_9_status, day_9_sent_at')
    .eq('id', rowId)
    .single();
  assert(afterCoupon?.day_9_status === 'sent_coupon', 'day_9_status sent_coupon');
  assert(afterCoupon?.day_9_sent_at != null, 'day_9_sent_at set');

  await supabase.from('trial_onboarding_messages').delete().eq('id', rowId);

  const emailB = testEmail('reminder');
  const reminderRowId = await insertExpiredTrial({
    conversationId,
    email: emailB,
    trialMs: KALYO_TRIAL_MS,
  });
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: 'Previous offer PRIMER50',
    source: 'text',
    source_type: 'claude',
    metadata: { coupon_offered: true, coupon_code: 'PRIMER50' },
  });

  const reminderEligibility = await evaluateDay9Eligibility(supabase, {
    trial_user_email: emailB,
    trial_ends_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    conversation_id: conversationId,
    unsubscribed: false,
    upgraded_to_paid_at: null,
    day_15_sent_at: new Date().toISOString(),
  });
  assert(reminderEligibility.action === 'send_coupon', 'prior coupon → final reminder with coupon');

  sentBodies.length = 0;
  const reminderRow = await fetchRowById(reminderRowId);
  const reminderResult = await processTrialOnboardingDay9Row({
    supabase,
    row: reminderRow,
    creds: mockCreds,
    sendFn: async (args) => {
      sentBodies.push(args.body);
    },
    sendTelegram: async () => {},
  });
  assert(reminderResult === 'sent', 'day9 final reminder sent for test row only');
  assert(sentBodies.some((b) => b.includes('recordatorio final')), 'final reminder body');
  assert(sentBodies.some((b) => b.includes('PRIMER50')), 'coupon repeated in final reminder');

  await cleanupAllTestRows();
  console.log('✓ All trial onboarding day 9 tests passed');
}

runTests().catch(async (err) => {
  console.error('❌ Test failed:', err);
  try {
    await cleanupAllTestRows();
  } catch {
    // best-effort cleanup
  }
  process.exit(1);
});
