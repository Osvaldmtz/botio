import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createKalyoTrialAccount } from '../lib/kalyo-account-creator';
import { getKalyoClient } from '../lib/kalyo-supabase';

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

loadEnvLocal();

const url = process.env.KALYO_SUPABASE_URL;
const key = process.env.KALYO_SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('Missing KALYO_SUPABASE_URL or KALYO_SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const ts = Date.now();
const emailNew = `botio-test-new-${ts}@kalyo-test.local`;
const emailActive = `botio-test-active-${ts}@kalyo-test.local`;
const emailExpired = `botio-test-expired-${ts}@kalyo-test.local`;
const emailRollback = `botio-test-rollback-${ts}@kalyo-test.local`;

async function cleanupEmail(email: string): Promise<void> {
  const sb = getKalyoClient();
  const { data } = await sb
    .from('psychologists')
    .select('auth_id')
    .eq('email', email)
    .maybeSingle();
  if (data?.auth_id) {
    await sb.from('psychologists').delete().eq('auth_id', data.auth_id);
    await sb.auth.admin.deleteUser(data.auth_id);
  }
}

async function authUserExists(email: string): Promise<boolean> {
  const sb = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await sb.auth.admin.listUsers({ perPage: 1000 });
  return (data?.users ?? []).some((u) => u.email?.toLowerCase() === email.toLowerCase());
}

async function main(): Promise<void> {
  let passed = 0;
  let failed = 0;

  const assert = (name: string, ok: boolean, detail?: string) => {
    if (ok) {
      console.log(`✓ ${name}`);
      passed++;
    } else {
      console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  };

  try {
    console.log('\n=== Test 1: new email → success ===');
    const r1 = await createKalyoTrialAccount({
      email: emailNew,
      fullName: 'Botio Test User',
      phone: '+529990000001',
    });
    assert('returns success', r1.success === true);
    if (r1.success) {
      assert('has password', Boolean(r1.password));
      assert('has user_id', Boolean(r1.user_id));
    }

    console.log('\n=== Test 2: active trial → trial_already_used ===');
    const r2 = await createKalyoTrialAccount({
      email: emailNew,
      fullName: 'Botio Test User',
    });
    assert(
      'returns trial_already_used',
      !r2.success && r2.error === 'trial_already_used',
      JSON.stringify(r2),
    );

    console.log('\n=== Test 3: expired trial → reactivation success ===');
    const r3setup = await createKalyoTrialAccount({
      email: emailExpired,
      fullName: 'Expired Trial User',
    });
    assert('setup account', r3setup.success === true);

    const sb = getKalyoClient();
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await sb
      .from('psychologists')
      .update({ trial_ends_at: past, plan_expires_at: past })
      .eq('email', emailExpired);

    const r3 = await createKalyoTrialAccount({
      email: emailExpired,
      fullName: 'Expired Trial User',
    });
    assert('reactivation success', r3.success === true);
    if (r3.success) {
      assert('reactivated flag', r3.reactivated === true);
    }

    console.log('\n=== Test 4: insert fail → auth rollback ===');
    const r4 = await createKalyoTrialAccount({
      email: emailRollback,
      fullName: 'Rollback Test',
      forceInsertFail: true,
    });
    assert('creation failed', r4.success === false);
    const orphan = await authUserExists(emailRollback);
    assert('auth user rolled back', orphan === false, `orphan=${orphan}`);

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    process.exit(failed > 0 ? 1 : 0);
  } finally {
    for (const email of [emailNew, emailActive, emailExpired, emailRollback]) {
      await cleanupEmail(email);
    }
    console.log('[cleanup] test accounts removed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
