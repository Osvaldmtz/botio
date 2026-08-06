/**
 * Smoke test for Block 1 weekly fetchers.
 * Run: npx tsx scripts/test-weekly-report-fetchers.ts
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
  const { fetchWeeklyReportData } = await import('../lib/weekly-report');
  console.log('Fetching weekly report data (last_7d + WoW)...\n');
  const data = await fetchWeeklyReportData();

  console.log('=== GSC ===');
  if (data.gsc.error) console.log('ERROR:', data.gsc.error);
  console.log(`Range: ${data.gsc.range.startDate} → ${data.gsc.range.endDate}`);
  console.log(fmtWow('Clicks', data.gsc.totals.clicks));
  console.log(fmtWow('Impressions', data.gsc.totals.impressions));
  console.log(fmtWow('CTR %', data.gsc.totals.ctr));
  console.log(fmtWow('Avg position', data.gsc.totals.position));
  console.log('Top pages (clicks):');
  for (const p of data.gsc.top_pages_by_clicks.slice(0, 5)) {
    console.log(`  ${p.clicks} clk | ${p.page}`);
  }
  console.log('Top queries (impressions):');
  for (const q of data.gsc.top_queries_by_impressions.slice(0, 5)) {
    console.log(`  ${q.impressions} imp | "${q.query}"`);
  }

  console.log('\n=== GOOGLE ADS ===');
  if (data.google_ads.error) console.log('ERROR:', data.google_ads.error);
  console.log(`Accounts: ${data.google_ads.customer_ids.join(', ')}`);
  console.log(`Range: ${data.google_ads.range.startDate} → ${data.google_ads.range.endDate}`);
  const g = data.google_ads.combined.totals;
  console.log(fmtWow('Spend COP', g.spend));
  console.log(fmtWow('Conversions', g.conversions));
  console.log(fmtWow('CTR %', g.ctr));
  console.log(fmtWow('CPA COP', g.cpa));
  console.log('Campaigns:');
  for (const c of data.google_ads.combined.campaigns.slice(0, 5)) {
    console.log(`  [${c.status}] ${c.campaign_name}: ${c.spend} COP, ${c.conversions} conv, CPA ${c.cpa ?? '—'}`);
  }

  console.log('\n=== META ADS ===');
  if (data.meta_ads.error) console.log('ERROR:', data.meta_ads.error);
  console.log(`Range: ${data.meta_ads.range.startDate} → ${data.meta_ads.range.endDate}`);
  const m = data.meta_ads.totals;
  console.log(fmtWow('Spend MXN', m.spend));
  console.log(fmtWow('Conversations', m.conversations));
  console.log(fmtWow('CTR %', m.ctr));
  console.log(fmtWow('CPA MXN', m.cpa));
  console.log('Active campaigns:');
  for (const c of data.meta_ads.active_campaigns.slice(0, 5)) {
    console.log(`  [${c.effective_status}] ${c.campaign_name}: $${c.spend} MXN, ${c.conversations} conv`);
  }

  console.log('\n--- Full JSON (truncated campaigns) ---');
  const slim = {
    ...data,
    google_ads: {
      ...data.google_ads,
      combined: { ...data.google_ads.combined, campaigns: data.google_ads.combined.campaigns.slice(0, 3) },
      by_account: data.google_ads.by_account.map((a) => ({ ...a, campaigns: a.campaigns.slice(0, 2) })),
    },
    meta_ads: { ...data.meta_ads, active_campaigns: data.meta_ads.active_campaigns.slice(0, 3) },
    gsc: {
      ...data.gsc,
      top_pages_by_clicks: data.gsc.top_pages_by_clicks.slice(0, 3),
      top_queries_by_impressions: data.gsc.top_queries_by_impressions.slice(0, 3),
    },
  };
  console.log(JSON.stringify(slim, null, 2));
}

function fmtWow(label: string, wow: { current: number; previous: number; delta: number; delta_pct: number | null }) {
  const pct = wow.delta_pct != null ? `${wow.delta_pct > 0 ? '+' : ''}${wow.delta_pct}%` : 'n/a';
  return `  ${label}: ${wow.current} (prev ${wow.previous}, Δ ${wow.delta}, ${pct})`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
