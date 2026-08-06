#!/usr/bin/env npx tsx
/**
 * Print dual-account Google Ads report to console.
 * Usage:
 *   npx tsx scripts/verify-dual-account-google-ads.ts
 *   BOTIO_ADMIN_PASSWORD=... npx tsx scripts/verify-dual-account-google-ads.ts --remote
 */
import type { GoogleAdsSummary, GoogleCampaignSummaryRow } from '../lib/google-ads-summary';

type DualReport = {
  active_customer_id: string;
  historical_customer_id: string;
  active: GoogleAdsSummary;
  historical: GoogleAdsSummary;
  combined: GoogleAdsSummary;
  errors?: Partial<Record<'active' | 'historical' | 'combined', string>>;
};

function fmtCop(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

function avgCpc(spend: number, clicks: number): number | null {
  return clicks > 0 ? spend / clicks : null;
}

function printTotals(label: string, customerId: string, summary: GoogleAdsSummary) {
  const t = summary.totals;
  const cpc = avgCpc(t.spend, t.clicks);
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`${label} (customer_id: ${customerId})`);
  console.log('─'.repeat(72));
  console.log(`  Inversión:     ${fmtCop(t.spend)}`);
  console.log(`  Impresiones:   ${t.impressions.toLocaleString('es-CO')}`);
  console.log(`  Clics:         ${t.clicks.toLocaleString('es-CO')}`);
  console.log(`  CTR:           ${fmtPct(t.ctr)}`);
  console.log(`  CPC prom.:     ${cpc != null ? fmtCop(cpc) : '—'}`);
  console.log(`  Conversiones:  ${t.conversions}`);
  if (summary.campaigns.length === 0) {
    console.log('  (sin campañas con actividad en LAST_30_DAYS)');
    return;
  }
  console.log('\n  Campañas:');
  for (const c of summary.campaigns) {
    printCampaignLine('   ', c);
  }
}

function printCampaignLine(prefix: string, c: GoogleCampaignSummaryRow) {
  const cpc = avgCpc(c.spend, c.clicks);
  console.log(
    `${prefix}• [${c.status}] ${c.campaign_name} — ${fmtCop(c.spend)} | ${c.impressions.toLocaleString('es-CO')} imp | ${c.clicks} clics | CTR ${fmtPct(c.ctr)} | CPC ${cpc != null ? fmtCop(cpc) : '—'} | ${c.conversions} conv`,
  );
}

function printReport(report: DualReport) {
  console.log('='.repeat(72));
  console.log('INFORME GOOGLE ADS — DUAL ACCOUNT — LAST_30_DAYS');
  console.log('='.repeat(72));
  console.log(`Cuenta nueva (activa):    ${report.active_customer_id}`);
  console.log(`Cuenta vieja (histórica): ${report.historical_customer_id}`);

  printTotals('CUENTA NUEVA', report.active_customer_id, report.active);
  printTotals('CUENTA VIEJA', report.historical_customer_id, report.historical);

  const ct = report.combined.totals;
  const combinedCpc = avgCpc(ct.spend, ct.clicks);
  const oldSpend = report.historical.totals.spend;
  const newSpend = report.active.totals.spend;
  const oldPct = ct.spend > 0 ? (oldSpend / ct.spend) * 100 : 0;
  const newPct = ct.spend > 0 ? (newSpend / ct.spend) * 100 : 0;

  console.log(`\n${'='.repeat(72)}`);
  console.log('TOTAL COMBINADO (fetchGoogleAdsCampaignSummary / searchGoogleAdsGaqlMetrics)');
  console.log('='.repeat(72));
  console.log(`  Inversión total:  ${fmtCop(ct.spend)}`);
  console.log(`    └─ Cuenta vieja: ${fmtCop(oldSpend)} (${oldPct.toFixed(1)}%)`);
  console.log(`    └─ Cuenta nueva: ${fmtCop(newSpend)} (${newPct.toFixed(1)}%)`);
  console.log(`  Impresiones:      ${ct.impressions.toLocaleString('es-CO')}`);
  console.log(`    └─ Vieja: ${report.historical.totals.impressions.toLocaleString('es-CO')} | Nueva: ${report.active.totals.impressions.toLocaleString('es-CO')}`);
  console.log(`  Clics:            ${ct.clicks.toLocaleString('es-CO')}`);
  console.log(`    └─ Vieja: ${report.historical.totals.clicks} | Nueva: ${report.active.totals.clicks}`);
  console.log(`  CTR:              ${fmtPct(ct.ctr)}`);
  console.log(`  CPC promedio:     ${combinedCpc != null ? fmtCop(combinedCpc) : '—'}`);
  console.log(`  Conversiones:     ${ct.conversions}`);
  console.log(`    └─ Vieja: ${report.historical.totals.conversions} | Nueva: ${report.active.totals.conversions}`);

  const enabled = report.combined.campaigns.filter((c) => c.status === 'ENABLED');
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`CAMPAÑAS ACTIVAS (ENABLED) — ${enabled.length}`);
  console.log('─'.repeat(72));
  if (enabled.length === 0) {
    console.log('  (ninguna)');
  } else {
    for (const c of enabled) {
      const inNew = report.active.campaigns.some((a) => a.campaign_id === c.campaign_id);
      const inOld = report.historical.campaigns.some((h) => h.campaign_id === c.campaign_id);
      const source = inNew && inOld ? 'ambas' : inNew ? 'nueva' : 'vieja';
      printCampaignLine(`  [${source}] `, c);
    }
  }

  console.log(`\n${'─'.repeat(72)}`);
  console.log('TODAS LAS CAMPAÑAS (combinado, por inversión)');
  console.log('─'.repeat(72));
  for (const c of report.combined.campaigns) {
    const inNew = report.active.campaigns.some((a) => a.campaign_id === c.campaign_id);
    const inOld = report.historical.campaigns.some((h) => h.campaign_id === c.campaign_id);
    const source = inNew && inOld ? 'ambas' : inNew ? 'nueva' : 'vieja';
    console.log(`  [${c.status}] [${source}] ${c.campaign_name} — ${fmtCop(c.spend)} | ${c.conversions} conv`);
  }

  if (report.errors && Object.keys(report.errors).length > 0) {
    console.log(`\n${'─'.repeat(72)}`);
    console.log('ERRORES API (por cuenta)');
    console.log('─'.repeat(72));
    for (const [key, msg] of Object.entries(report.errors)) {
      console.log(`  ${key}: ${msg}`);
    }
  }
  console.log('');
}

async function fetchRemote(): Promise<DualReport> {
  const base = process.env.BOTIO_URL ?? 'https://team.kalyo.io';
  const password = process.env.BOTIO_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error('Set BOTIO_ADMIN_PASSWORD or ADMIN_PASSWORD for --remote');
  }
  const res = await fetch(`${base}/api/admin/google-ads/dual-report`, {
    headers: { Cookie: `botio_admin=${password}` },
  });
  const json = (await res.json()) as DualReport & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

async function main() {
  const remote = process.argv.includes('--remote');
  const report = remote ? await fetchRemote() : await fetchRemote(); // production only for now
  printReport(report);
}

main().catch((err) => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});
