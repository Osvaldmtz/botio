#!/usr/bin/env npx tsx
/**
 * Replace LIMITED PMax text assets in asset group 6736991807 (account 4732777525).
 * Usage: npx tsx scripts/replace-pmax-text-assets.ts
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { OAuth2Client } from 'google-auth-library';

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

const GOOGLE_ADS_API = 'https://googleads.googleapis.com/v25';
const CUSTOMER_ID = '4732777525';
const ASSET_GROUP_ID = '6736991807';

const REMOVALS = [
  {
    resourceName: `customers/${CUSTOMER_ID}/assetGroupAssets/${ASSET_GROUP_ID}~404180369156~HEADLINE`,
    expectedText: 'Kalyo para Psicólogos',
  },
  {
    resourceName: `customers/${CUSTOMER_ID}/assetGroupAssets/${ASSET_GROUP_ID}~404281946620~HEADLINE`,
    expectedText: 'Asistente WhatsApp incluido',
  },
  {
    resourceName: `customers/${CUSTOMER_ID}/assetGroupAssets/${ASSET_GROUP_ID}~404281977799~DESCRIPTION`,
    expectedText:
      'Asistente de WhatsApp incluido. Ideal para psicólogos en México y Colombia.',
  },
] as const;

const ADDITIONS = [
  // Google Ads headline max 30 chars; user text is 33 — closest valid variant keeps intent + brand
  { fieldType: 'HEADLINE', text: 'Organiza consultorio con Kalyo' },
  { fieldType: 'HEADLINE', text: 'Asistente virtual incluido' },
  {
    fieldType: 'DESCRIPTION',
    text: 'Asistente virtual por chat incluido. Ideal para consultorios en México y Colombia.',
  },
] as const;

async function getAccessToken(): Promise<string> {
  const oauth2 = new OAuth2Client(
    process.env.GOOGLE_ADS_CLIENT_ID,
    process.env.GOOGLE_ADS_CLIENT_SECRET,
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN });
  const res = await oauth2.getAccessToken();
  if (!res.token) throw new Error('No access token');
  return res.token;
}

function apiHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!.trim(),
    'Content-Type': 'application/json',
  };
}

async function gaqlSearch(query: string, token: string) {
  const res = await fetch(`${GOOGLE_ADS_API}/customers/${CUSTOMER_ID}/googleAds:search`, {
    method: 'POST',
    headers: apiHeaders(token),
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  const json = JSON.parse(text);
  if (!res.ok) throw new Error(JSON.stringify(json, null, 2));
  return json.results ?? [];
}

async function mutateAssets(token: string, operations: Record<string, unknown>[]) {
  const res = await fetch(`${GOOGLE_ADS_API}/customers/${CUSTOMER_ID}/assets:mutate`, {
    method: 'POST',
    headers: apiHeaders(token),
    body: JSON.stringify({ operations }),
  });
  const text = await res.text();
  const json = JSON.parse(text);
  if (!res.ok) throw new Error(JSON.stringify(json, null, 2));
  return json;
}

async function mutateAssetGroupAssets(
  token: string,
  operations: Record<string, unknown>[],
) {
  const res = await fetch(
    `${GOOGLE_ADS_API}/customers/${CUSTOMER_ID}/assetGroupAssets:mutate`,
    {
      method: 'POST',
      headers: apiHeaders(token),
      body: JSON.stringify({ operations }),
    },
  );
  const text = await res.text();
  const json = JSON.parse(text);
  if (!res.ok) throw new Error(JSON.stringify(json, null, 2));
  return json;
}

async function verifyAssets(token: string) {
  const rows = await gaqlSearch(
    `SELECT
      asset.id,
      asset_group_asset.field_type,
      asset_group_asset.status,
      asset_group_asset.primary_status,
      asset_group_asset.policy_summary.approval_status,
      asset.text_asset.text
    FROM asset_group_asset
    WHERE asset_group.id = ${ASSET_GROUP_ID}
      AND asset_group_asset.status = 'ENABLED'
      AND asset.text_asset.text IS NOT NULL`,
    token,
  );
  return rows;
}

async function main() {
  process.env.GOOGLE_ADS_CUSTOMER_ID = CUSTOMER_ID;
  console.log(`Customer: ${CUSTOMER_ID}, Asset group: ${ASSET_GROUP_ID}`);

  for (const item of ADDITIONS) {
    const max = item.fieldType === 'HEADLINE' ? 30 : 90;
    if (item.text.length > max) {
      console.warn(
        `WARN: ${item.fieldType} exceeds ${max} chars (${item.text.length}): "${item.text}"`,
      );
    }
  }

  const token = await getAccessToken();

  // Verify old assets still present
  const before = await verifyAssets(token);
  for (const removal of REMOVALS) {
    const found = before.find(
      (row: { asset?: { textAsset?: { text?: string } } }) =>
        row.asset?.textAsset?.text === removal.expectedText,
    );
    if (!found) {
      console.warn(`WARN: expected asset not found before removal: "${removal.expectedText}"`);
    }
  }

  // Remove old assets if still linked
  const toRemove = REMOVALS.filter((removal) =>
    before.some(
      (row: { asset?: { textAsset?: { text?: string } } }) =>
        row.asset?.textAsset?.text === removal.expectedText,
    ),
  );
  if (toRemove.length === 0) {
    console.log('\n--- Old assets already removed, skipping ---');
  } else {
    console.log('\n--- Removing old assets ---');
    const removeOps = toRemove.map((r) => ({ remove: r.resourceName }));
    const removeResult = await mutateAssetGroupAssets(token, removeOps);
    console.log(JSON.stringify(removeResult, null, 2));
  }

  const missingAdditions = ADDITIONS.filter(
    (item) =>
      !before.some(
        (row: { asset?: { textAsset?: { text?: string } } }) =>
          row.asset?.textAsset?.text === item.text,
      ),
  );
  if (missingAdditions.length === 0) {
    console.log('\n--- All replacement assets already present ---');
  } else {
  const assetGroupResource = `customers/${CUSTOMER_ID}/assetGroups/${ASSET_GROUP_ID}`;

  const assetCreateOps = missingAdditions.map((item) => ({
    create: { textAsset: { text: item.text } },
  }));
  const assetResult = await mutateAssets(token, assetCreateOps);
  console.log('Created assets:', JSON.stringify(assetResult, null, 2));

  const createdResourceNames: string[] = (assetResult.results ?? []).map(
    (r: { resourceName: string }) => r.resourceName,
  );
  if (createdResourceNames.length !== missingAdditions.length) {
    throw new Error('Asset creation count mismatch');
  }

  const linkOps = missingAdditions.map((item, i) => ({
    create: {
      assetGroup: assetGroupResource,
      asset: createdResourceNames[i],
      fieldType: item.fieldType,
    },
  }));
  const createResult = await mutateAssetGroupAssets(token, linkOps);
  console.log(JSON.stringify(createResult, null, 2));
  }

  console.log('\n--- Verification ---');
  const after = await verifyAssets(token);
  const texts = after.map(
    (row: {
      asset?: { textAsset?: { text?: string } };
      assetGroupAsset?: { fieldType?: string; primaryStatus?: string; policySummary?: { approvalStatus?: string } };
    }) => ({
      field: row.assetGroupAsset?.fieldType,
      text: row.asset?.textAsset?.text,
      primaryStatus: row.assetGroupAsset?.primaryStatus,
      approvalStatus: row.assetGroupAsset?.policySummary?.approvalStatus,
    }),
  );
  console.log(JSON.stringify(texts, null, 2));

  const newTexts = ADDITIONS.map((a) => a.text);
  const oldTexts = REMOVALS.map((r) => r.expectedText);
  const stillHasOld = texts.some((t: { text?: string }) => oldTexts.includes(t.text ?? ''));
  const hasAllNew = newTexts.every((nt) =>
    texts.some((t: { text?: string }) => t.text === nt),
  );

  if (stillHasOld) throw new Error('Old assets still present after mutation');
  if (!hasAllNew) throw new Error('Not all new assets found after mutation');

  console.log('\nDone — all 3 replacements applied successfully.');
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
