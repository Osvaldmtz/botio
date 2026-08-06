/**
 * Test Block 2 — weekly report builder (uses fallback summary without ANTHROPIC_API_KEY).
 * Run: npx tsx scripts/test-weekly-report-builder.ts
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
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

async function main() {
  const { buildWeeklyMarketingReport } = await import('../lib/weekly-report-builder');
  const { renderWeeklyReportHtml } = await import('../lib/weekly-report-html');
  const { formatWeeklyReportTelegram } = await import('../lib/weekly-report-telegram');

  console.log('Building weekly marketing report...\n');
  const report = await buildWeeklyMarketingReport();

  console.log('=== EXECUTIVE SUMMARY (5 bullets) ===');
  report.executive_summary.forEach((b, i) => console.log(`${i + 1}. ${b}`));

  console.log('\n=== CHANNEL COMPARE ===');
  console.log(`Meta CPA USD: $${report.channel_compare.meta.cpa_usd?.toFixed(2) ?? '—'}`);
  console.log(`Google CPA USD: $${report.channel_compare.google.cpa_usd?.toFixed(2) ?? '—'}`);
  console.log(`Recommendation: ${report.channel_compare.budget_recommendation}`);

  console.log('\n=== SEO POSITIONS ===');
  console.log(`Improved: ${report.seo_position.keywords_improved ?? '—'}`);
  console.log(`Declined: ${report.seo_position.keywords_declined ?? '—'}`);
  console.log('Top improved:', report.seo_position.top_improved.slice(0, 3).map((k) => k.keyword));

  console.log('\n=== ERRORS ===');
  console.log(report.errors.length ? report.errors : '(none)');

  const html = renderWeeklyReportHtml(report);
  console.log(`\nHTML length: ${html.length} chars`);

  const telegram = formatWeeklyReportTelegram(report, 'https://example.com/report.html');
  console.log(`Telegram length: ${telegram.length} chars`);
  console.log('\n--- Telegram preview ---\n');
  console.log(telegram.slice(0, 800));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
