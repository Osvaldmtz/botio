import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  enrollTrialFromKalyoWebhook,
  validateTrialEnrollBody,
} from '../lib/trial-onboarding-webhook';
import { emailToWebOnlyPhone, isWebOnlyPhone } from '../lib/web-only-phone';
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
if (!url || !key) {
  console.error('Missing Supabase env');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const testPhone = `+5299903${String(Date.now()).slice(-5)}`;
const testEmail = `enroll-webhook-${Date.now()}@kalyo-test.local`;
const sentTelegram: string[] = [];

async function cleanup(): Promise<void> {
  await supabase.from('trial_onboarding_messages').delete().eq('customer_phone', testPhone);
  await supabase.from('trial_onboarding_messages').delete().eq('trial_user_email', testEmail);
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

async function runTests(): Promise<void> {
  console.log('Trial enroll webhook tests\n');
  await cleanup();

  const invalid = validateTrialEnrollBody({ email: 'bad', name: '', phone: '123' });
  assert(!invalid.ok, 'invalid body rejected');

  const badPhone = validateTrialEnrollBody({
    email: testEmail,
    name: 'Test',
    phone: '551234',
  });
  assert(!badPhone.ok, 'invalid phone rejected by validator');

  const noPhoneValid = validateTrialEnrollBody({
    email: `no-phone-${Date.now()}@kalyo-test.local`,
    name: 'Web Only',
  });
  assert(noPhoneValid.ok, 'missing phone accepted for web-only enroll');

  const result = await enrollTrialFromKalyoWebhook(
    {
      email: testEmail,
      name: 'Webhook Test User',
      phone: testPhone,
      source: 'kalyo_web',
    },
    {
      supabase,
      skipWhatsApp: true,
      sendTelegram: async (text) => {
        sentTelegram.push(text);
      },
    },
  );

  assert(result.success === true, 'first enroll succeeds');
  if (!result.success) throw new Error('expected success');

  const { data: onboardingRow } = await supabase
    .from('trial_onboarding_messages')
    .select('id, conversation_id, trial_user_email')
    .eq('id', result.trial_onboarding_id)
    .single();
  assert(!!onboardingRow, 'trial_onboarding_messages row exists');
  assert(onboardingRow?.trial_user_email === testEmail, 'email saved');

  const { data: conv } = await supabase
    .from('conversations')
    .select('id, lead_score, lead_temperature, metadata')
    .eq('id', result.conversation_id)
    .single();
  assert(!!conv, 'conversation created');
  assert(conv?.lead_score === 50, 'lead_score set');

  assert(sentTelegram.length >= 1, 'telegram enrollment alert sent');
  assert(sentTelegram[0].includes('Onboarding cron'), 'telegram has enroll text');

  const duplicate = await enrollTrialFromKalyoWebhook(
    {
      email: testEmail,
      name: 'Webhook Test User',
      phone: testPhone,
      source: 'kalyo_web',
    },
    { supabase, skipWhatsApp: true },
  );
  assert(duplicate.success === false && duplicate.reason === 'already_enrolled', 'duplicate skipped');

  // Test: re-enrollment con trial vencido NO debe crear nuevo registro (caso Ariadne)
  const expiredEmail = `enroll-expired-${Date.now()}@kalyo-test.local`;
  const expiredPhone = `+5299904${String(Date.now()).slice(-5)}`;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAfterThat = new Date(Date.now() - KALYO_TRIAL_MS).toISOString();

  await supabase.from('trial_onboarding_messages').insert({
    customer_phone: expiredPhone,
    trial_user_email: expiredEmail,
    trial_user_name: 'Expired Test User',
    trial_started_at: thirtyDaysAgo,
    trial_ends_at: sevenDaysAfterThat,
  });

  const reEnroll = await enrollTrialFromKalyoWebhook(
    {
      email: expiredEmail,
      name: 'Expired Test User',
      phone: expiredPhone,
      source: 'retroactive_popup',
    },
    { supabase, skipWhatsApp: true },
  );
  assert(
    reEnroll.success === false && reEnroll.reason === 'already_enrolled',
    'expired trial: re-enrollment blocked (no duplicate row, no welcome)',
  );

  const { data: expiredRows } = await supabase
    .from('trial_onboarding_messages')
    .select('id')
    .eq('trial_user_email', expiredEmail);
  assert((expiredRows ?? []).length === 1, 'expired trial: exactly 1 row exists (no duplicate created)');

  await supabase.from('trial_onboarding_messages').delete().eq('trial_user_email', expiredEmail);
  console.log('  ✓ expired trial re-enrollment correctly blocked');

  const webOnlyEmail = `enroll-webonly-${Date.now()}@kalyo-test.local`;
  const webOnlyResult = await enrollTrialFromKalyoWebhook(
    { email: webOnlyEmail, name: 'Rosa Web Only', source: 'kalyo_web' },
    { supabase, skipWhatsApp: true },
  );
  assert(webOnlyResult.success === true, 'web-only enroll succeeds');
  const expectedWebPhone = emailToWebOnlyPhone(webOnlyEmail);
  const { data: webConv } = await supabase
    .from('conversations')
    .select('customer_phone, metadata')
    .eq('id', webOnlyResult.conversation_id)
    .single();
  assert(webConv?.customer_phone === expectedWebPhone, 'web-only phone assigned');
  assert(isWebOnlyPhone(webConv?.customer_phone), 'phone flagged as web-only');
  const webMeta = webConv?.metadata as Record<string, unknown> | null;
  assert(webMeta?.customer_email === webOnlyEmail, 'email stored on web-only conv');
  await supabase.from('trial_onboarding_messages').delete().eq('trial_user_email', webOnlyEmail);
  await supabase.from('conversations').delete().eq('id', webOnlyResult.conversation_id);
  console.log('  ✓ web-only enroll without phone');

  await cleanup();
  console.log('\nAll trial enroll webhook tests passed.');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
