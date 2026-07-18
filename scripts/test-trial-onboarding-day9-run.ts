import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  evaluateDay9Eligibility,
  hadPriorCouponOffer,
} from '../lib/trial-onboarding-day9-eligibility';
import { fetchPendingOnboardingDay, runTrialOnboardingCron } from '../lib/trial-onboarding-cron';
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

const testPhone = `+5299903${String(Date.now()).slice(-5)}`;
const testEmail = `day9-test-${Date.now()}@example.com`;

async function cleanup(): Promise<void> {
  await supabase.from('trial_onboarding_messages').delete().eq('customer_phone', testPhone);
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

async function insertExpiredTrial(conversationId: string): Promise<string> {
  const startedAt = new Date(Date.now() - 216 * 60 * 60 * 1000);
  const endsAt = new Date(startedAt.getTime() + KALYO_TRIAL_MS);
  const { data, error } = await supabase
    .from('trial_onboarding_messages')
    .insert({
      customer_phone: testPhone,
      trial_user_email: testEmail,
      trial_user_name: 'Day9 Test',
      trial_started_at: startedAt.toISOString(),
      trial_ends_at: endsAt.toISOString(),
      conversation_id: conversationId,
      day_15_sent_at: new Date(startedAt.getTime() + 168 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('insert failed');
  return data.id as string;
}

async function runTests(): Promise<void> {
  console.log('Trial onboarding day 9 tests\n');
  await cleanup();

  const conversationId = await ensureConversation();
  const rowId = await insertExpiredTrial(conversationId);

  const pending9 = await fetchPendingOnboardingDay(supabase, 9);
  assert(pending9.some((r) => r.id === rowId), 'day9 pending at 216h window');

  const eligibility = await evaluateDay9Eligibility(supabase, {
    trial_user_email: testEmail,
    trial_ends_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    conversation_id: conversationId,
    unsubscribed: false,
    upgraded_to_paid_at: null,
    day_15_sent_at: new Date().toISOString(),
  });
  assert(eligibility.action === 'send_coupon', 'eligible for PRIMER50');

  const sentBodies: string[] = [];
  const cron = await runTrialOnboardingCron({
    supabase,
    creds: { accountSid: 'ACtest', authToken: 'test', from: 'whatsapp:+10000000000' },
    sendFn: async (args) => {
      sentBodies.push(args.body);
    },
  });
  assert((cron.sent_day9 ?? 0) >= 1, 'day9 coupon sent');
  assert(sentBodies.some((b) => b.includes('PRIMER50')), 'body includes coupon');

  const hadCoupon = await hadPriorCouponOffer(supabase, {
    conversationId,
    email: testEmail,
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

  const rowNoCouponId = await insertExpiredTrial(conversationId);
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: 'Previous offer PRIMER50',
    source: 'text',
    source_type: 'claude',
    metadata: { coupon_offered: true, coupon_code: 'PRIMER50' },
  });

  const noCouponEligibility = await evaluateDay9Eligibility(supabase, {
    trial_user_email: testEmail,
    trial_ends_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    conversation_id: conversationId,
    unsubscribed: false,
    upgraded_to_paid_at: null,
    day_15_sent_at: new Date().toISOString(),
  });
  assert(noCouponEligibility.action === 'send_no_coupon', 'prior coupon → no_coupon message');

  sentBodies.length = 0;
  const cronNoCoupon = await runTrialOnboardingCron({
    supabase,
    creds: { accountSid: 'ACtest', authToken: 'test', from: 'whatsapp:+10000000000' },
    sendFn: async (args) => {
      sentBodies.push(args.body);
    },
  });
  assert((cronNoCoupon.sent_day9 ?? 0) >= 1, 'day9 no-coupon sent');
  assert(sentBodies.some((b) => b.includes('cuando estés listo')), 'soft follow-up body');
  assert(!sentBodies.some((b) => b.includes('PRIMER50')), 'no coupon in no-coupon path');

  await cleanup();
  console.log('✓ All trial onboarding day 9 tests passed');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
