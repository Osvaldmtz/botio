/**
 * Trial tracking consistency tests.
 *
 *   npx tsx scripts/test-trial-tracking-consistency.ts
 */
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ensureTrialTrackingConsistency } from '../lib/trial-tracking-consistency';
import { fetchLearningMetrics } from '../lib/learning-queries';
import {
  getTrialTrackingFailureCount,
  resetTrialTrackingFailureCount,
} from '../lib/trial-tracking-metrics';

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
const testPhone = `+5299910${runId}`;
const testEmail = `trial-track-${runId}@kalyo-test.local`;
const createdConvIds: string[] = [];

async function createTestConversation(
  client: SupabaseClient,
  phone: string,
  email: string,
): Promise<string> {
  const { data, error } = await client
    .from('conversations')
    .insert({
      customer_phone: phone,
      bot_id: '64f6eed2-1522-48fe-a2c6-f858b767df06',
      pipeline_stage: 'qualified',
      last_message_at: new Date().toISOString(),
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
    await supabase.from('trial_onboarding_messages').delete().eq('conversation_id', id);
    await supabase.from('pipeline_stage_history').delete().eq('conversation_id', id);
    await supabase.from('messages').delete().eq('conversation_id', id);
  }
  if (createdConvIds.length) {
    await supabase.from('conversations').delete().in('id', createdConvIds);
  }
  await supabase.from('trial_onboarding_messages').delete().eq('trial_user_email', testEmail);
}

async function testAlreadyActiveSync(): Promise<void> {
  const convId = await createTestConversation(supabase, testPhone, testEmail);
  const trialEndsAt = new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString();

  const result = await ensureTrialTrackingConsistency(supabase, {
    conversationId: convId,
    email: testEmail,
    phone: testPhone,
    source: 'already_active_sync',
    trialEndsAt,
  });

  assert(result.pipeline_updated || result.outcome_updated || result.onboarding_created, 'should update something');

  const { data } = await supabase
    .from('conversations')
    .select('pipeline_stage, outcome, outcome_source')
    .eq('id', convId)
    .single();

  assert(data?.pipeline_stage === 'trial', 'pipeline should be trial');
  assert(data?.outcome === 'trial_activated', 'outcome should be trial_activated');
  assert(data?.outcome_source === 'already_active_sync', 'source should be already_active_sync');

  const { data: onboarding } = await supabase
    .from('trial_onboarding_messages')
    .select('id')
    .eq('conversation_id', convId)
    .maybeSingle();
  assert(Boolean(onboarding), 'onboarding row should exist');

  console.log('✓ already_active sync marks pipeline + outcome + onboarding');
}

async function testIdempotent(): Promise<void> {
  const convId = createdConvIds[0];
  assert(convId, 'conv from prior test');

  const second = await ensureTrialTrackingConsistency(supabase, {
    conversationId: convId,
    email: testEmail,
    phone: testPhone,
    source: 'already_active_sync',
  });

  assert(second.already_consistent, 'second call should be idempotent');
  console.log('✓ ensureTrialTrackingConsistency is idempotent');
}

async function testFailureCounter(): Promise<void> {
  resetTrialTrackingFailureCount();
  assert(getTrialTrackingFailureCount() === 0, 'counter starts at 0');
  console.log('✓ failure counter module');
}

async function testLiveMetricsAlignment(): Promise<void> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { count: outcomeCount } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('outcome', 'trial_activated')
    .gte('outcome_date', since)
    .or('is_ambassador.is.null,is_ambassador.eq.false')
    .or('is_team_member.is.null,is_team_member.eq.false');

  const learning = await fetchLearningMetrics(supabase);

  console.log(`  outcome query count (30d): ${outcomeCount ?? 0}`);
  console.log(`  learning.trial_activated (all time): ${learning.trial_activated}`);

  assert(typeof outcomeCount === 'number', 'outcome count should be a number');
  assert(learning.trial_activated >= (outcomeCount ?? 0), 'learning total should be >= 30d outcomes');
  console.log('✓ outcome metrics query runs (funnel uses same source post-fix)');
}

async function main(): Promise<void> {
  console.log('[test] trial tracking consistency\n');
  try {
    await testFailureCounter();
    await testAlreadyActiveSync();
    await testIdempotent();
    await testLiveMetricsAlignment();
    console.log('\n[test] ALL PASSED');
  } finally {
    await cleanup();
  }
}

void main().catch((err) => {
  console.error('[test] FAILED', err);
  process.exit(1);
});
