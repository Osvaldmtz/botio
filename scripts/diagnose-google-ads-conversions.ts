#!/usr/bin/env npx tsx
/**
 * Diagnose Google Ads conversion issues — raw GAQL output.
 * Usage: npx tsx scripts/diagnose-google-ads-conversions.ts
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

function printSection(title: string, query: string, rows: unknown[]) {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
  console.log('QUERY:\n', query.trim(), '\n');
  console.log(`RESULTS (${rows.length} rows):`);
  console.log(JSON.stringify(rows, null, 2));
}

async function main() {
  const { searchGoogleAdsGaql, getActiveCustomerId } = await import('../lib/google-ads-api');
  const customerId = getActiveCustomerId();
  console.log(`Google Ads diagnostic — customer_id: ${customerId}`);
  console.log(`OAuth configured: ${Boolean(process.env.GOOGLE_ADS_REFRESH_TOKEN)}`);

  const queries: Array<{ title: string; query: string }> = [
    {
      title: '1. CAMPAIGNS — status, budget, spend today, limitations',
      query: `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.serving_status,
          campaign.primary_status,
          campaign.primary_status_reasons,
          campaign.advertising_channel_type,
          campaign_budget.amount_micros,
          campaign_budget.status,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.conversions,
          metrics.conversions_value
        FROM campaign
        WHERE segments.date DURING TODAY
          AND campaign.status != 'REMOVED'
      `,
    },
    {
      title: '1b. CAMPAIGNS — last 7 days metrics (no date= today filter)',
      query: `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.primary_status,
          campaign.primary_status_reasons,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.conversions
        FROM campaign
        WHERE segments.date DURING LAST_7_DAYS
          AND campaign.status != 'REMOVED'
      `,
    },
    {
      title: '2. CONVERSION ACTIONS — configured & status',
      query: `
        SELECT
          conversion_action.id,
          conversion_action.name,
          conversion_action.status,
          conversion_action.type,
          conversion_action.category,
          conversion_action.origin,
          conversion_action.primary_for_goal,
          conversion_action.include_in_conversions_metric,
          conversion_action.tag_snippets,
          conversion_action.counting_type,
          conversion_action.click_through_lookback_window_days,
          conversion_action.view_through_lookback_window_days
        FROM conversion_action
        WHERE conversion_action.status != 'REMOVED'
      `,
    },
    {
      title: '3. AD GROUPS — status & primary status',
      query: `
        SELECT
          campaign.id,
          campaign.name,
          ad_group.id,
          ad_group.name,
          ad_group.status,
          ad_group.primary_status,
          ad_group.primary_status_reasons,
          metrics.impressions,
          metrics.clicks,
          metrics.conversions
        FROM ad_group
        WHERE segments.date DURING LAST_7_DAYS
          AND ad_group.status != 'REMOVED'
          AND campaign.status != 'REMOVED'
      `,
    },
    {
      title: '4. ADS — approval & policy status',
      query: `
        SELECT
          campaign.id,
          campaign.name,
          ad_group.id,
          ad_group.name,
          ad_group_ad.ad.id,
          ad_group_ad.ad.type,
          ad_group_ad.status,
          ad_group_ad.primary_status,
          ad_group_ad.primary_status_reasons,
          ad_group_ad.policy_summary.approval_status,
          ad_group_ad.policy_summary.review_status,
          ad_group_ad.policy_summary.policy_topic_entries
        FROM ad_group_ad
        WHERE ad_group_ad.status != 'REMOVED'
          AND campaign.status != 'REMOVED'
      `,
    },
    {
      title: '5. ADS — metrics last 7 days',
      query: `
        SELECT
          campaign.name,
          ad_group.name,
          ad_group_ad.ad.id,
          ad_group_ad.status,
          ad_group_ad.policy_summary.approval_status,
          metrics.impressions,
          metrics.clicks,
          metrics.conversions
        FROM ad_group_ad
        WHERE segments.date DURING LAST_7_DAYS
          AND ad_group_ad.status != 'REMOVED'
          AND campaign.status != 'REMOVED'
      `,
    },
    {
      title: '6. ASSET GROUPS — PMax policy & status',
      query: `
        SELECT
          campaign.name,
          asset_group.id,
          asset_group.name,
          asset_group.status,
          asset_group.primary_status,
          asset_group.primary_status_reasons,
          asset_group.ad_strength
        FROM asset_group
        WHERE campaign.status != 'REMOVED'
          AND asset_group.status != 'REMOVED'
      `,
    },
    {
      title: '7. CONVERSIONS BY ACTION — last 30 days',
      query: `
        SELECT
          campaign.name,
          segments.conversion_action,
          segments.conversion_action_name,
          metrics.conversions,
          metrics.all_conversions
        FROM campaign
        WHERE segments.date DURING LAST_30_DAYS
          AND campaign.status != 'REMOVED'
      `,
    },
    {
      title: '8. CUSTOMER — conversion tracking settings',
      query: `
        SELECT
          customer.conversion_tracking_setting.conversion_tracking_id,
          customer.conversion_tracking_setting.conversion_tracking_status,
          customer.conversion_tracking_setting.cross_account_conversion_tracking_id,
          customer.conversion_tracking_setting.accepted_customer_data_terms
        FROM customer
      `,
    },
  ];

  for (const { title, query } of queries) {
    try {
      const rows = await searchGoogleAdsGaql(query);
      printSection(title, query, rows);
    } catch (err) {
      console.log('\n' + '='.repeat(80));
      console.log(title);
      console.log('='.repeat(80));
      console.log('QUERY:\n', query.trim(), '\n');
      console.error('ERROR:', err instanceof Error ? err.message : err);
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message ?? err);
  process.exit(1);
});
