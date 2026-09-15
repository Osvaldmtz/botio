#!/usr/bin/env npx tsx
/** Replace single PMax headline in asset group 6736991807. */
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
const OLD_ASSET_ID = '404195400656';
const OLD_TEXT = 'Organiza consultorio con Kalyo';
const NEW_TEXT = 'Tu consultorio con Kalyo';
const REMOVE_RESOURCE = `customers/${CUSTOMER_ID}/assetGroupAssets/${ASSET_GROUP_ID}~${OLD_ASSET_ID}~HEADLINE`;

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

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!.trim(),
    'Content-Type': 'application/json',
  };
}

async function mutate(path: string, token: string, operations: Record<string, unknown>[]) {
  const res = await fetch(`${GOOGLE_ADS_API}/customers/${CUSTOMER_ID}/${path}:mutate`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ operations }),
  });
  const json = JSON.parse(await res.text());
  if (!res.ok) throw new Error(JSON.stringify(json, null, 2));
  return json;
}

async function main() {
  const token = await getAccessToken();

  const verifyRes = await fetch(`${GOOGLE_ADS_API}/customers/${CUSTOMER_ID}/googleAds:search`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      query: `
        SELECT asset.id, asset.text_asset.text
        FROM asset_group_asset
        WHERE asset_group.id = ${ASSET_GROUP_ID}
          AND asset.id = ${OLD_ASSET_ID}
          AND asset_group_asset.status = 'ENABLED'
      `,
    }),
  });
  const verifyJson = JSON.parse(await verifyRes.text());
  if (!verifyRes.ok) throw new Error(JSON.stringify(verifyJson, null, 2));
  const current = verifyJson.results?.[0]?.asset?.textAsset?.text;
  if (current !== OLD_TEXT) {
    throw new Error(`Expected "${OLD_TEXT}" on asset ${OLD_ASSET_ID}, found "${current ?? 'none'}"`);
  }

  console.log('Removing old headline link...');
  console.log(JSON.stringify(await mutate('assetGroupAssets', token, [{ remove: REMOVE_RESOURCE }]), null, 2));

  console.log('Creating new headline asset...');
  const assetResult = await mutate('assets', token, [{ create: { textAsset: { text: NEW_TEXT } } }]);
  console.log(JSON.stringify(assetResult, null, 2));
  const newAsset = assetResult.results[0].resourceName as string;

  console.log('Linking to asset group...');
  const linkResult = await mutate('assetGroupAssets', token, [
    {
      create: {
        assetGroup: `customers/${CUSTOMER_ID}/assetGroups/${ASSET_GROUP_ID}`,
        asset: newAsset,
        fieldType: 'HEADLINE',
      },
    },
  ]);
  console.log(JSON.stringify(linkResult, null, 2));

  const afterRes = await fetch(`${GOOGLE_ADS_API}/customers/${CUSTOMER_ID}/googleAds:search`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      query: `
        SELECT asset.id, asset.text_asset.text, asset_group_asset.primary_status
        FROM asset_group_asset
        WHERE asset_group.id = ${ASSET_GROUP_ID}
          AND asset.text_asset.text IN ('${OLD_TEXT}', '${NEW_TEXT}')
          AND asset_group_asset.status = 'ENABLED'
      `,
    }),
  });
  const afterJson = JSON.parse(await afterRes.text());
  console.log('\nVerification:', JSON.stringify(afterJson.results, null, 2));

  const hasNew = afterJson.results?.some(
    (r: { asset?: { textAsset?: { text?: string } } }) => r.asset?.textAsset?.text === NEW_TEXT,
  );
  const hasOld = afterJson.results?.some(
    (r: { asset?: { textAsset?: { text?: string } } }) => r.asset?.textAsset?.text === OLD_TEXT,
  );
  if (!hasNew || hasOld) throw new Error('Replacement verification failed');
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
