import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  MAX_MESSAGES_PER_WINDOW,
  TEST_PHONES,
} from '../lib/rate-limit';

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const botId = process.env.KALYO_BOT_ID ?? '64f6eed2-1522-48fe-a2c6-f858b767df06';

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const testPhone = `+5299900${String(Date.now()).slice(-5)}`;

async function cleanupPhone(phone: string): Promise<void> {
  await supabase.from('rate_limit_events').delete().eq('customer_phone', phone);
  await supabase.from('rate_limit_blocks').delete().eq('customer_phone', phone);
}

async function runRateLimitScenario(): Promise<boolean> {
  await cleanupPhone(testPhone);

  const results: boolean[] = [];
  for (let i = 1; i <= 12; i += 1) {
    const result = await checkRateLimit(supabase, testPhone, botId, null);
    const expectedAllowed = i <= MAX_MESSAGES_PER_WINDOW;
    const ok = result.allowed === expectedAllowed;
    results.push(ok);
    console.log(
      `${ok ? '✓' : '✗'} request ${i}: allowed=${result.allowed} count=${result.current_count}`,
    );
  }

  const { data: blocks, error: blocksError } = await supabase
    .from('rate_limit_blocks')
    .select('id, messages_count, reason')
    .eq('customer_phone', testPhone)
    .order('blocked_at', { ascending: false })
    .limit(1);

  if (blocksError) {
    console.error('✗ could not query rate_limit_blocks:', blocksError.message);
    return false;
  }

  const hasBlock = (blocks?.length ?? 0) > 0;
  if (hasBlock) {
    console.log(`✓ rate_limit_blocks row created: count=${blocks![0].messages_count}`);
  } else {
    console.error('✗ expected a rate_limit_blocks row after exceeding limit');
  }

  await cleanupPhone(testPhone);
  return results.every(Boolean) && hasBlock;
}

async function runBypassScenario(): Promise<boolean> {
  const bypassPhone = TEST_PHONES[0];
  await cleanupPhone(bypassPhone);

  let ok = true;
  for (let i = 1; i <= 15; i += 1) {
    const result = await checkRateLimit(supabase, bypassPhone, botId, null);
    if (!result.allowed) {
      console.error(`✗ bypass request ${i}: unexpectedly blocked`);
      ok = false;
    }
  }

  const { count } = await supabase
    .from('rate_limit_events')
    .select('id', { count: 'exact', head: true })
    .eq('customer_phone', bypassPhone);

  if ((count ?? 0) > 0) {
    console.error(`✗ bypass phone should not create rate_limit_events (found ${count})`);
    ok = false;
  } else {
    console.log(`✓ TEST_PHONE ${bypassPhone}: 15/15 bypassed, no events recorded`);
  }

  await cleanupPhone(bypassPhone);
  return ok;
}

async function main(): Promise<void> {
  console.log('--- Rate limit scenario (12 rapid requests) ---');
  const rateOk = await runRateLimitScenario();

  console.log('\n--- Bypass scenario (TEST_PHONE) ---');
  const bypassOk = await runBypassScenario();

  if (rateOk && bypassOk) {
    console.log('\nAll rate-limit tests passed');
    process.exit(0);
  }

  console.error('\nSome rate-limit tests failed');
  console.error(
    'If tables are missing, apply supabase/migrations/0010_rate_limiting.sql first.',
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
