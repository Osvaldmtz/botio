import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  CONVERSATION_OUTCOMES,
  setConversationOutcome,
  markPaidByEmail,
  processCustomerPaid,
} from '../lib/conversation-outcome';
import { emailToWebOnlyPhone, isWebOnlyPhone } from '../lib/web-only-phone';
import { enrollTrialFromKalyoWebhook } from '../lib/trial-onboarding-webhook';
import {
  fetchLearningMetrics,
  fetchOutcomeDistribution,
} from '../lib/learning-queries';

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

const runId = String(Date.now()).slice(-6);
const testPhone = `+5299904${runId}`;
const testEmail = `outcome-test-${runId}@kalyo-test.local`;
const stalePhone = `+5299905${runId}`;
const createdConvIds: string[] = [];

async function createTestConversation(
  client: SupabaseClient,
  phone: string,
  email: string,
  lastMessageAt: string,
): Promise<string> {
  const { data, error } = await client
    .from('conversations')
    .insert({
      customer_phone: phone,
      bot_id: '64f6eed2-1522-48fe-a2c6-f858b767df06',
      last_message_at: lastMessageAt,
      metadata: { customer_email: email, email },
      is_ambassador: false,
      is_team_member: false,
    })
    .select('id')
    .single();

  if (error || !data) throw error ?? new Error('insert conversation failed');
  createdConvIds.push(data.id as string);
  return data.id as string;
}

async function cleanup(): Promise<void> {
  for (const id of createdConvIds) {
    await supabase.from('messages').delete().eq('conversation_id', id);
  }
  if (createdConvIds.length) {
    await supabase.from('conversations').delete().in('id', createdConvIds);
  }
  await supabase.from('trial_onboarding_messages').delete().eq('customer_phone', testPhone);
  await supabase.from('trial_onboarding_messages').delete().eq('trial_user_email', testEmail);
}

async function testStripePaidMark(): Promise<void> {
  const convId = await createTestConversation(supabase, testPhone, testEmail, new Date().toISOString());
  const updated = await markPaidByEmail(supabase, testEmail, 'stripe_webhook');
  assert(updated === 1, 'stripe paid should update one conversation');

  const { data } = await supabase
    .from('conversations')
    .select('outcome, outcome_source')
    .eq('id', convId)
    .single();

  assert(data?.outcome === 'paid', 'outcome should be paid');
  assert(data?.outcome_source === 'stripe_webhook', 'source should be stripe_webhook');
  console.log('✓ Stripe paid marks conversation');
}

async function testPaidViaTrialOnboardingFallback(): Promise<void> {
  const phone = `+5299908${runId}`;
  const email = `outcome-onboarding-${runId}@kalyo-test.local`;

  const result = await enrollTrialFromKalyoWebhook(
    { email, name: 'Onboarding Paid Test', phone, source: 'outcome_test' },
    { supabase, skipWhatsApp: true },
  );
  assert(result.success === true, 'trial enroll should succeed');
  createdConvIds.push(result.conversation_id);

  await supabase
    .from('conversations')
    .update({ outcome: 'trial_activated', outcome_source: 'trial_enroll' })
    .eq('id', result.conversation_id);

  await supabase
    .from('conversations')
    .update({ metadata: {} })
    .eq('id', result.conversation_id);

  const updated = await markPaidByEmail(supabase, email, 'stripe_webhook');
  assert(updated === 1, 'paid should resolve conversation via trial_onboarding fallback');

  const { data } = await supabase
    .from('conversations')
    .select('outcome')
    .eq('id', result.conversation_id)
    .single();
  assert(data?.outcome === 'paid', 'trial onboarding conv should be paid');

  await supabase.from('trial_onboarding_messages').delete().eq('trial_user_email', email);
  console.log('✓ Paid resolves conversation via trial_onboarding fallback');
}

async function testProcessCustomerPaidCreatesWebOnlyConversation(): Promise<void> {
  const email = `outcome-webonly-${runId}@kalyo-test.local`;
  const webPhone = emailToWebOnlyPhone(email);
  assert(isWebOnlyPhone(webPhone), 'web-only phone uses +999 prefix');

  const result = await processCustomerPaid(supabase, email, 'kalyo_upgrade', {
    name: 'Web Only Client',
  });
  assert(result.conversation_created === true, 'should create web-only conversation');
  assert(result.outcome_updated === 1, 'should mark outcome paid');

  const { data } = await supabase
    .from('conversations')
    .select('id, customer_phone, outcome, channel, metadata')
    .eq('customer_phone', webPhone)
    .maybeSingle();

  assert(data?.outcome === 'paid', 'web-only conv should be paid');
  assert(data?.channel === 'web', 'web-only conv channel should be web');
  const meta = data?.metadata as Record<string, unknown> | null;
  assert(meta?.customer_email === email, 'email stored in metadata');
  assert(meta?.web_only === true, 'web_only flag set');

  if (data?.id) createdConvIds.push(data.id as string);
  console.log('✓ processCustomerPaid creates web-only conversation when missing');
}

async function testTrialEnrollMark(): Promise<void> {
  const phone = `+5299906${runId}`;
  const email = `outcome-trial-${runId}@kalyo-test.local`;

  const result = await enrollTrialFromKalyoWebhook(
    {
      email,
      name: 'Outcome Test',
      phone,
      source: 'outcome_test',
    },
    { supabase, skipWhatsApp: true },
  );

  assert(result.success === true, 'trial enroll should succeed');
  createdConvIds.push(result.conversation_id);

  const { data } = await supabase
    .from('conversations')
    .select('outcome, outcome_source')
    .eq('id', result.conversation_id)
    .single();

  assert(data?.outcome === 'trial_activated', 'outcome should be trial_activated');
  assert(data?.outcome_source === 'trial_enroll', 'source should be trial_enroll');
  console.log('✓ Trial enroll marks conversation');

  await supabase.from('trial_onboarding_messages').delete().eq('trial_user_email', email);
}

async function testCronLostMark(): Promise<void> {
  const staleDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const email = `outcome-stale-${runId}@kalyo-test.local`;
  const convId = await createTestConversation(supabase, stalePhone, email, staleDate);

  const result = await setConversationOutcome(supabase, {
    conversationId: convId,
    outcome: 'lost_no_response',
    source: 'cron_30days',
  });
  assert(result.updated === 1, 'stale conversation should be marked lost');

  const { data } = await supabase
    .from('conversations')
    .select('outcome, outcome_source')
    .eq('id', convId)
    .single();

  assert(data?.outcome === 'lost_no_response', 'stale conv should be lost_no_response');
  assert(data?.outcome_source === 'cron_30days', 'source should be cron_30days');
  console.log('✓ Cron logic marks lost_no_response after 30d (isolated)');
}

async function testManualOutcome(): Promise<void> {
  const phone = `+5299907${runId}`;
  const email = `outcome-manual-${runId}@kalyo-test.local`;
  const convId = await createTestConversation(supabase, phone, email, new Date().toISOString());

  const result = await setConversationOutcome(supabase, {
    conversationId: convId,
    outcome: 'lost_competitor',
    source: 'admin_manual',
    notes: 'Eligió Doctoralia',
    force: true,
  });

  assert(result.updated === 1, 'manual outcome should update');

  const { data } = await supabase
    .from('conversations')
    .select('outcome, outcome_source, metadata')
    .eq('id', convId)
    .single();

  assert(data?.outcome === 'lost_competitor', 'manual outcome set');
  assert(data?.outcome_source === 'admin_manual', 'manual source set');
  const meta = data?.metadata as Record<string, unknown> | null;
  assert(meta?.outcome_notes === 'Eligió Doctoralia', 'notes stored in metadata');
  console.log('✓ Manual outcome endpoint logic');
}

async function testDashboardQueries(): Promise<void> {
  const distribution = await fetchOutcomeDistribution(supabase);
  assert(Array.isArray(distribution), 'distribution is array');

  const metrics = await fetchLearningMetrics(supabase);
  assert(typeof metrics.conversion_rate === 'number', 'conversion_rate is number');
  assert(metrics.total >= 0, 'total is non-negative');

  const hasPaid = distribution.some((row) => row.outcome === 'paid');
  assert(hasPaid || metrics.paid >= 0, 'distribution query runs');

  for (const outcome of CONVERSATION_OUTCOMES) {
    assert(typeof outcome === 'string', 'outcome constants defined');
  }

  console.log('✓ Dashboard queries return distribution and metrics');
}

async function runTests(): Promise<void> {
  console.log('Outcome tracking tests\n');
  await cleanup();

  await testStripePaidMark();
  await testPaidViaTrialOnboardingFallback();
  await testProcessCustomerPaidCreatesWebOnlyConversation();
  await testTrialEnrollMark();
  await testCronLostMark();
  await testManualOutcome();
  await testDashboardQueries();

  await cleanup();
  console.log('\nAll outcome tracking tests passed.');
}

runTests().catch(async (err) => {
  console.error(err);
  await cleanup().catch(() => undefined);
  process.exit(1);
});
