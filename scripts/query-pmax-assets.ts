#!/usr/bin/env npx tsx
/** Query PMax asset group coverage for ad strength diagnosis. */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
require.cache[require.resolve('server-only')] = {
  id: '',
  filename: '',
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
  process.env.GOOGLE_ADS_CUSTOMER_ID = '4732777525';
  const { searchGoogleAdsGaql } = await import('../lib/google-ads-api');

  const rows = await searchGoogleAdsGaql(`
    SELECT
      campaign.name,
      asset_group.name,
      asset_group.ad_strength,
      asset_group.primary_status,
      asset_group.primary_status_reasons,
      asset_group_asset.field_type,
      asset_group_asset.status,
      asset_group_asset.primary_status,
      asset_group_asset.primary_status_reasons,
      asset.text_asset.text,
      asset.image_asset.full_size.url,
      asset.youtube_video_asset.youtube_video_id
    FROM asset_group_asset
    WHERE campaign.status != 'REMOVED'
      AND asset_group.status != 'REMOVED'
  `);

  const byField = new Map<string, number>();
  const limited: unknown[] = [];
  for (const row of rows) {
    const field = String(row.assetGroupAsset?.fieldType ?? 'UNKNOWN');
    byField.set(field, (byField.get(field) ?? 0) + 1);
    if (row.assetGroupAsset?.primaryStatus === 'NOT_ELIGIBLE' || row.assetGroupAsset?.primaryStatus === 'LIMITED') {
      limited.push(row);
    }
  }

  console.log('=== Asset counts by field_type ===');
  for (const [k, v] of [...byField.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${k}: ${v}`);
  }
  console.log('\n=== Raw rows ===');
  console.log(JSON.stringify(rows, null, 2));
  if (limited.length) {
    console.log('\n=== Limited / not eligible assets ===');
    console.log(JSON.stringify(limited, null, 2));
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
