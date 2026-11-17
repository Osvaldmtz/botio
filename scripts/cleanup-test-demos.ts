/**
 * Cleanup test scheduled demos (DB + Google Calendar events).
 *
 * Dry-run (default):
 *   npx tsx scripts/cleanup-test-demos.ts
 *
 * Execute deletes:
 *   npx tsx scripts/cleanup-test-demos.ts --confirm
 *
 * Optional day override (UTC calendar day for scheduled_at):
 *   npx tsx scripts/cleanup-test-demos.ts --day=2026-09-15
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve('server-only');
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeModule;

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
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

loadEnvFile(join(process.cwd(), '.env.local'));
loadEnvFile(join(process.cwd(), '.env.vercel.prod'));

const EXACT_TEST_EMAILS = new Set([
  'osvacolombia@gmail.com',
  'osvaldo@coloris.mx',
]);

const TEST_EMAIL_RE = /(test|qa|prueba|kalyo-test)/i;

type DemoRow = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  scheduled_at: string;
  status: string | null;
  google_event_id: string | null;
  created_at: string;
};

function parseArgs(argv: string[]): { confirm: boolean; day: string } {
  let confirm = false;
  let day = '2026-09-15';
  for (const arg of argv) {
    if (arg === '--confirm') confirm = true;
    const dayMatch = arg.match(/^--day=(\d{4}-\d{2}-\d{2})$/);
    if (dayMatch) day = dayMatch[1];
  }
  return { confirm, day };
}

function isTestEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  if (EXACT_TEST_EMAILS.has(lower)) return true;
  return TEST_EMAIL_RE.test(lower);
}

function matchReason(row: DemoRow, dayStartIso: string, dayEndIso: string): string[] {
  const reasons: string[] = [];
  const at = new Date(row.scheduled_at).getTime();
  if (at >= new Date(dayStartIso).getTime() && at < new Date(dayEndIso).getTime()) {
    reasons.push(`scheduled_at on ${dayStartIso.slice(0, 10)}`);
  }
  if (isTestEmail(row.customer_email)) {
    reasons.push(`test email (${row.customer_email})`);
  }
  return reasons;
}

async function main(): Promise<void> {
  const { confirm, day } = parseArgs(process.argv.slice(2));
  const dayStartIso = `${day}T00:00:00.000Z`;
  const dayEnd = new Date(`${day}T00:00:00.000Z`);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  const dayEndIso = dayEnd.toISOString();

  const { createAdminClient } = await import('../lib/supabase/admin');
  const { deleteDemoCalendarEvent } = await import('../lib/google-calendar');

  const supabase = createAdminClient();

  // Fetch recent demos + anything on the target day; filter in JS for email patterns.
  const { data, error } = await supabase
    .from('scheduled_demos')
    .select(
      'id, customer_name, customer_email, customer_phone, scheduled_at, status, google_event_id, created_at',
    )
    .or(
      `and(scheduled_at.gte.${dayStartIso},scheduled_at.lt.${dayEndIso}),created_at.gte.${dayStartIso}`,
    )
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw new Error(`Failed to list scheduled_demos: ${error.message}`);

  const rows = (data ?? []) as DemoRow[];
  const targets = rows
    .map((row) => ({ row, reasons: matchReason(row, dayStartIso, dayEndIso) }))
    .filter((t) => t.reasons.length > 0);

  // Also catch test emails outside the day window (exact list / pattern) from a broader pull.
  const { data: emailHits, error: emailErr } = await supabase
    .from('scheduled_demos')
    .select(
      'id, customer_name, customer_email, customer_phone, scheduled_at, status, google_event_id, created_at',
    )
    .or(
      [
        'customer_email.ilike.%test%',
        'customer_email.ilike.%qa%',
        'customer_email.ilike.%prueba%',
        'customer_email.ilike.%kalyo-test%',
        'customer_email.eq.osvacolombia@gmail.com',
        'customer_email.eq.osvaldo@coloris.mx',
      ].join(','),
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (emailErr) {
    console.warn(`[cleanup] email filter query warning: ${emailErr.message}`);
  }

  const byId = new Map(targets.map((t) => [t.row.id, t]));
  for (const row of (emailHits ?? []) as DemoRow[]) {
    if (byId.has(row.id)) continue;
    if (!isTestEmail(row.customer_email)) continue;
    byId.set(row.id, { row, reasons: [`test email (${row.customer_email})`] });
  }

  const selected = [...byId.values()].sort(
    (a, b) => new Date(b.row.created_at).getTime() - new Date(a.row.created_at).getTime(),
  );

  console.log(`\nCleanup test demos — day=${day} mode=${confirm ? 'CONFIRM' : 'DRY-RUN'}`);
  console.log(`Note: calendar auth uses shared getCalendarClient() (no calendar_credentials_id on scheduled_demos).\n`);

  if (selected.length === 0) {
    console.log('No matching demos found.');
    return;
  }

  console.log(`Found ${selected.length} demo(s) to clean:\n`);
  for (const { row, reasons } of selected) {
    console.log(
      [
        `• id=${row.id}`,
        `  name=${row.customer_name ?? '—'}`,
        `  email=${row.customer_email ?? '—'}`,
        `  phone=${row.customer_phone ?? '—'}`,
        `  scheduled_at=${row.scheduled_at}`,
        `  status=${row.status ?? '—'}`,
        `  google_event_id=${row.google_event_id ?? '(none)'}`,
        `  created_at=${row.created_at}`,
        `  match=${reasons.join('; ')}`,
      ].join('\n'),
    );
    console.log('');
  }

  if (!confirm) {
    console.log('Dry-run only. Re-run with --confirm to delete Calendar events + DB rows.');
    return;
  }

  let deletedEvents = 0;
  let skippedEvents = 0;
  let deletedRows = 0;
  let failed = 0;

  for (const { row } of selected) {
    try {
      if (row.google_event_id) {
        try {
          await deleteDemoCalendarEvent(row.google_event_id);
          deletedEvents += 1;
          console.log(`✓ Calendar event deleted: ${row.google_event_id}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          // 404/410 = already gone
          if (/Not Found|404|410|Resource has been deleted/i.test(message)) {
            skippedEvents += 1;
            console.log(`~ Calendar event already gone: ${row.google_event_id} (${message})`);
          } else {
            throw err;
          }
        }
      } else {
        skippedEvents += 1;
        console.log(`~ No google_event_id for demo ${row.id}`);
      }

      const { error: delErr } = await supabase.from('scheduled_demos').delete().eq('id', row.id);
      if (delErr) throw new Error(delErr.message);
      deletedRows += 1;
      console.log(`✓ DB row deleted: ${row.id} (${row.customer_email})\n`);
    } catch (err) {
      failed += 1;
      console.error(`✗ Failed demo ${row.id}:`, err);
    }
  }

  console.log(
    `\nDone. events_deleted=${deletedEvents} events_skipped=${skippedEvents} rows_deleted=${deletedRows} failed=${failed}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
