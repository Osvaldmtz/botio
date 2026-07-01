/**
 * One-time backfill: set conversations.outcome for trials enrolled via
 * trial_onboarding_messages but missing outcome.
 *
 * Usage:
 *   npx tsx scripts/backfill-trial-outcomes.ts           # dry-run (default)
 *   npx tsx scripts/backfill-trial-outcomes.ts --apply   # write to DB
 */
import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

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

type OrphanRow = {
  id: string;
  customer_phone: string;
  trial_user_email: string;
  trial_started_at: string;
  tom_created_at: string;
};

async function fetchOrphans(supabase: ReturnType<typeof createClient>): Promise<OrphanRow[]> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('trial_onboarding_messages')
    .select(
      'trial_user_email, trial_started_at, created_at, conversation_id, conversations!inner(id, customer_phone, outcome, is_ambassador)',
    )
    .gte('created_at', since)
    .not('conversation_id', 'is', null);

  if (error) throw error;

  const rows: OrphanRow[] = [];
  for (const row of data ?? []) {
    const conv = row.conversations as {
      id: string;
      customer_phone: string;
      outcome: string | null;
      is_ambassador: boolean | null;
    } | null;
    if (!conv || conv.outcome || conv.is_ambassador === true) continue;
    rows.push({
      id: conv.id,
      customer_phone: conv.customer_phone,
      trial_user_email: row.trial_user_email as string,
      trial_started_at: row.trial_started_at as string,
      tom_created_at: row.created_at as string,
    });
  }

  return rows;
}

async function main(): Promise<void> {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const apply = process.argv.includes('--apply');
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const orphans = await fetchOrphans(supabase);
  console.log(`[backfill] orphans found: ${orphans.length} (mode=${apply ? 'APPLY' : 'DRY-RUN'})`);

  if (orphans.length === 0) {
    console.log('[backfill] nothing to do');
    return;
  }

  for (const row of orphans.slice(0, 10)) {
    console.log(
      `  - conv=${row.id} | ${row.trial_user_email} | trial_started=${row.trial_started_at}`,
    );
  }
  if (orphans.length > 10) {
    console.log(`  ... and ${orphans.length - 10} more`);
  }

  if (!apply) {
    console.log('[backfill] dry-run complete. Re-run with --apply to update.');
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const row of orphans) {
    const outcomeDate = row.trial_started_at || row.tom_created_at;
    const { error } = await supabase
      .from('conversations')
      .update({
        outcome: 'trial_activated',
        outcome_date: outcomeDate,
        outcome_source: 'backfill_from_onboarding',
      })
      .eq('id', row.id)
      .is('outcome', null);

    if (error) {
      console.error(`[backfill] failed conv=${row.id}`, error.message);
      failed += 1;
    } else {
      updated += 1;
    }
  }

  console.log(`[backfill] done | updated=${updated} | failed=${failed}`);
}

void main().catch((err) => {
  console.error('[backfill] fatal', err);
  process.exit(1);
});
