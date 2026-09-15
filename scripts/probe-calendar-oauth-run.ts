/**
 * Probe Google Calendar OAuth refresh. Run: npx tsx scripts/probe-calendar-oauth-run.ts
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

async function main() {
  const { createAdminClient } = await import('../lib/supabase/admin');
  const {
    getCalendarConnectionStatus,
    getCalendarClient,
    getAvailableSlots,
    DEMO_HOST_EMAIL,
  } = await import('../lib/google-calendar');

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from('calendar_credentials')
    .select('host_email, token_expires_at, updated_at')
    .eq('host_email', DEMO_HOST_EMAIL)
    .maybeSingle();

  console.log('BEFORE', before);

  const status = await getCalendarConnectionStatus({ probe: true });
  console.log('STATUS', status);

  if (!status.connected || !status.healthy) {
    console.error('OAUTH_FAILED', status.healthError);
    process.exit(1);
  }

  const client = await getCalendarClient();
  const cal = await client.calendarList.get({ calendarId: 'primary' });
  console.log('PRIMARY_CAL', { id: cal.data.id, summary: cal.data.summary });

  const start = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);
  const { slots } = await getAvailableSlots({
    startDate: start,
    endDate: end,
    durationMinutes: 30,
  });
  console.log(
    'SLOTS',
    slots.map((s) => s.label_es),
  );

  const { data: after } = await supabase
    .from('calendar_credentials')
    .select('host_email, token_expires_at, updated_at')
    .eq('host_email', DEMO_HOST_EMAIL)
    .maybeSingle();

  console.log('AFTER', after);
  console.log('OAUTH_OK');
}

main().catch((err) => {
  console.error('OAUTH_FAILED', err);
  process.exit(1);
});
