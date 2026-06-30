import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  buildDirectEnrollmentWelcomeMessage,
  enrollTrialDirect,
  normalizeEnrollPhone,
  validateTrialEnrollDirectBody,
  type DirectWelcomeTwilioFns,
} from '../lib/trial-enroll-direct';

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

function makeTwilioMock(capture: { body?: string; to?: string; calls: number }): DirectWelcomeTwilioFns {
  return {
    sendPlain: async (args) => {
      capture.body = args.body;
      capture.to = args.to;
      capture.calls += 1;
      return { sid: 'SM_test_enroll' };
    },
    fetchStatus: async () => ({ status: 'queued' }),
    sleep: async () => {},
  };
}

async function cleanup(
  supabase: SupabaseClient,
  phone: string,
  email: string,
): Promise<void> {
  await supabase.from('trial_onboarding_messages').delete().eq('customer_phone', phone);
  await supabase.from('trial_onboarding_messages').delete().eq('trial_user_email', email);
  const { data: convs } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_phone', phone);
  const ids = (convs ?? []).map((c) => c.id);
  if (ids.length) {
    await supabase.from('messages').delete().in('conversation_id', ids);
    await supabase.from('conversations').delete().in('id', ids);
  }
}

async function testNewAccountWithPassword(supabase: SupabaseClient): Promise<void> {
  const phone = `+5299905${String(Date.now()).slice(-5)}`;
  const email = `enroll-direct-new-${Date.now()}@kalyo-test.local`;
  const capture = { calls: 0 as number, body: undefined as string | undefined, to: undefined as string | undefined };
  const twilio = makeTwilioMock(capture);

  const trialEndsAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

  const result = await enrollTrialDirect(
    {
      email,
      fullName: 'Dra. Test Password',
      phone,
      trialStartedAt: new Date().toISOString(),
      trialEndsAt,
      isNewAccount: true,
      tempPassword: 'Kalyo-2026-TEST',
      source: 'kaly_admin',
    },
    { supabase, twilio },
  );

  assert(result.ok === true, 'new account enroll succeeds');
  if (!result.ok) throw new Error('expected success');
  assert(capture.calls === 1, 'Twilio called once');
  assert(!!capture.body?.includes('Kalyo-2026-TEST'), 'welcome contains password');
  assert(!!capture.body?.includes(email), 'welcome contains email');
  assert(capture.to === phone, 'Twilio to uses normalized phone');

  const { data: row } = await supabase
    .from('trial_onboarding_messages')
    .select('welcome_msg_status, trial_user_email')
    .eq('id', result.enrollment_id)
    .single();
  assert(row?.welcome_msg_status === 'sent', 'welcome_msg_status is sent');
  assert(row?.trial_user_email === email, 'email saved in enrollment');

  const { data: msg } = await supabase
    .from('messages')
    .select('content, metadata')
    .eq('conversation_id', result.conversation_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  assert(!!msg?.content.includes('Kalyo-2026-TEST'), 'stored message contains password');
  assert(
    (msg?.metadata as Record<string, unknown> | null)?.source === 'enrollment_direct',
    'message metadata source is enrollment_direct',
  );

  await cleanup(supabase, phone, email);
  console.log('  ✓ new account with password');
}

async function testReactivationWithoutPassword(supabase: SupabaseClient): Promise<void> {
  const phone = `+5299906${String(Date.now()).slice(-5)}`;
  const email = `enroll-direct-react-${Date.now()}@kalyo-test.local`;
  const capture = { calls: 0 as number, body: undefined as string | undefined, to: undefined as string | undefined };
  const twilio = makeTwilioMock(capture);
  const trialEndsAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

  const result = await enrollTrialDirect(
    {
      email,
      fullName: 'Dr. Reactivado',
      phone,
      trialStartedAt: new Date().toISOString(),
      trialEndsAt,
      isNewAccount: false,
      source: 'kaly_admin',
    },
    { supabase, twilio },
  );

  assert(result.ok === true, 'reactivation enroll succeeds');
  assert(capture.calls === 1, 'Twilio called for reactivation');
  assert(!capture.body?.includes('Kalyo-2026'), 'reactivation welcome has no temp password');
  assert(
    !!capture.body?.toLowerCase().includes('olvid'),
    'reactivation welcome mentions forgot password',
  );

  await cleanup(supabase, phone, email);
  console.log('  ✓ reactivation without password');
}

function testValidationErrors(): void {
  const missingPassword = validateTrialEnrollDirectBody({
    email: 'test@kalyo.io',
    full_name: 'Test',
    phone: '+5255512345678',
    trial_started_at: new Date().toISOString(),
    trial_ends_at: new Date(Date.now() + 15 * 86400000).toISOString(),
    is_new_account: true,
    source: 'kaly_admin',
  });
  assert(!missingPassword.ok, 'missing temp_password rejected');
  if (!missingPassword.ok) {
    assert(
      missingPassword.error.includes('temp_password'),
      'error mentions temp_password',
    );
  }

  const normalized = normalizeEnrollPhone('whatsapp:+5255512345678');
  assert(normalized === '+5255512345678', 'whatsapp: prefix stripped');

  const welcome = buildDirectEnrollmentWelcomeMessage({
    fullName: 'Ana',
    email: 'ana@test.com',
    trialEndsAt: '2026-07-15T00:00:00.000Z',
    isNewAccount: true,
    tempPassword: 'Kalyo-2026-ABCD',
  });
  assert(welcome.includes('Kalyo-2026-ABCD'), 'builder includes password for new account');

  const reactivationWelcome = buildDirectEnrollmentWelcomeMessage({
    fullName: 'Ana',
    email: 'ana@test.com',
    trialEndsAt: '2026-07-15T00:00:00.000Z',
    isNewAccount: false,
  });
  assert(
    reactivationWelcome.toLowerCase().includes('olvid'),
    'builder mentions forgot password for reactivation',
  );

  console.log('  ✓ validation and phone normalization');
}

async function runTests(): Promise<void> {
  console.log('Trial enroll direct (password) tests\n');

  testValidationErrors();

  if (!url || !key) {
    console.log('  (skipping DB integration tests — missing Supabase env)');
    console.log('\nValidation tests passed.');
    return;
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await testNewAccountWithPassword(supabase);
  await testReactivationWithoutPassword(supabase);

  console.log('\nAll trial enroll direct tests passed.');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
