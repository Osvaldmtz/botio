/** Print Telegram message body without sending (uses prod env). */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
require.cache[require.resolve('server-only')] = {
  id: 'server-only',
  filename: 'server-only',
  loaded: true,
  exports: {},
} as NodeModule;

function loadEnv(file: string) {
  const envPath = join(process.cwd(), file);
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnv('.env.vercel');
loadEnv('.env.local');

async function main() {
  const { buildWeeklyMarketingReport } = await import('../lib/weekly-report-builder');
  const { formatWeeklyReportTelegram } = await import('../lib/weekly-report-telegram');
  const report = await buildWeeklyMarketingReport();
  const url =
    'https://ongdjmofytgjlqxuiqft.supabase.co/storage/v1/object/public/weekly-reports/marketing/2026-08-05.html';
  console.log(formatWeeklyReportTelegram(report, url));
}

main().catch(console.error);
