#!/usr/bin/env npx tsx
/** Replace PMax YouTube videos in asset group 6736991807. */
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

const REMOVE_ASSET_IDS = [
  '403315163444',
  '403418245969',
  '403418248078',
  '403488410037',
] as const;

/** 4 most recent non-Short videos (>60s) from @kalyoapp/videos */
const NEW_YOUTUBE_IDS = [
  '_Px63buMUpc', // 5:08 — Notas Clínicas
  'xunWu_pyOKg', // 2:50 — Modo de Evaluaciones
  'InEDhxaKekM', // 2:23 — Modulo de Pacientes
  'cv9iUxuqDqA', // 1:09 — Pantalla Inicial
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

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!.trim(),
    'Content-Type': 'application/json',
  };
}

async function gaql(token: string, query: string) {
  const res = await fetch(`${GOOGLE_ADS_API}/customers/${CUSTOMER_ID}/googleAds:search`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ query }),
  });
  const json = JSON.parse(await res.text());
  if (!res.ok) throw new Error(JSON.stringify(json, null, 2));
  return json.results ?? [];
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
  const assetGroupResource = `customers/${CUSTOMER_ID}/assetGroups/${ASSET_GROUP_ID}`;

  const before = await gaql(
    token,
    `SELECT asset.id, asset.youtube_video_asset.youtube_video_id, asset_group_asset.status
     FROM asset_group_asset
     WHERE asset_group.id = ${ASSET_GROUP_ID}
       AND asset_group_asset.field_type = 'YOUTUBE_VIDEO'
       AND asset_group_asset.status = 'ENABLED'`,
  );
  console.log('Before:', JSON.stringify(before, null, 2));

  const linkedYoutubeIds = new Set(
    before.map(
      (r: { asset?: { youtubeVideoAsset?: { youtubeVideoId?: string } } }) =>
        r.asset?.youtubeVideoAsset?.youtubeVideoId,
    ),
  );
  const toAdd = NEW_YOUTUBE_IDS.filter((id) => !linkedYoutubeIds.has(id));

  if (toAdd.length === 0) {
    console.log('\nAll target videos already linked.');
  } else {
    // Reuse existing customer-level YouTube assets when present
    const existingAssetRows = await gaql(
      token,
      `SELECT asset.resource_name, asset.youtube_video_asset.youtube_video_id
       FROM asset
       WHERE asset.type = 'YOUTUBE_VIDEO'
         AND asset.youtube_video_asset.youtube_video_id IN (${toAdd.map((id) => `'${id}'`).join(', ')})`,
    );
    const assetByYoutubeId = new Map<string, string>();
    for (const row of existingAssetRows as Array<{
      asset?: { resourceName?: string; youtubeVideoAsset?: { youtubeVideoId?: string } };
    }>) {
      const ytId = row.asset?.youtubeVideoAsset?.youtubeVideoId;
      const resourceName = row.asset?.resourceName;
      if (ytId && resourceName) assetByYoutubeId.set(ytId, resourceName);
    }

    const missingYoutubeIds = toAdd.filter((id) => !assetByYoutubeId.has(id));
    if (missingYoutubeIds.length > 0) {
      console.log('\nCreating YouTube video assets...');
      const assetOps = missingYoutubeIds.map((youtubeVideoId) => ({
        create: { youtubeVideoAsset: { youtubeVideoId } },
      }));
      const assetResult = await mutate('assets', token, assetOps);
      console.log(JSON.stringify(assetResult, null, 2));
      for (let i = 0; i < missingYoutubeIds.length; i++) {
        assetByYoutubeId.set(
          missingYoutubeIds[i],
          assetResult.results[i].resourceName as string,
        );
      }
    }

    const linkOps = toAdd.map((youtubeVideoId) => ({
      create: {
        assetGroup: assetGroupResource,
        asset: assetByYoutubeId.get(youtubeVideoId),
        fieldType: 'YOUTUBE_VIDEO',
      },
    }));
    console.log('\nLinking new videos to asset group (before removing old)...');
    console.log(JSON.stringify(await mutate('assetGroupAssets', token, linkOps), null, 2));
  }

  const enabledAssetIds = new Set(
    before.map((r: { asset?: { id?: string } }) => r.asset?.id).filter(Boolean),
  );
  const removeOps = REMOVE_ASSET_IDS.filter((id) => enabledAssetIds.has(id)).map((id) => ({
    remove: `customers/${CUSTOMER_ID}/assetGroupAssets/${ASSET_GROUP_ID}~${id}~YOUTUBE_VIDEO`,
  }));
  if (removeOps.length === 0) {
    console.log('\nOld YouTube assets already removed from asset group.');
  } else {
    console.log('\nRemoving old videos...');
    console.log(JSON.stringify(await mutate('assetGroupAssets', token, removeOps), null, 2));
  }

  const after = await gaql(
    token,
    `SELECT
       asset.id,
       asset.youtube_video_asset.youtube_video_id,
       asset_group_asset.primary_status,
       asset_group_asset.policy_summary.approval_status
     FROM asset_group_asset
     WHERE asset_group.id = ${ASSET_GROUP_ID}
       AND asset_group_asset.field_type = 'YOUTUBE_VIDEO'
       AND asset_group_asset.status = 'ENABLED'`,
  );
  console.log('\nAfter:', JSON.stringify(after, null, 2));

  const linkedIds = after.map(
    (r: { asset?: { youtubeVideoAsset?: { youtubeVideoId?: string } } }) =>
      r.asset?.youtubeVideoAsset?.youtubeVideoId,
  );
  for (const id of NEW_YOUTUBE_IDS) {
    if (!linkedIds.includes(id)) throw new Error(`Missing new video ${id}`);
  }
  for (const oldId of ['Xv2Xt3S5yVY', 'HX12IjEwXSc', 'rlRC-dGAjbM', 'uIooW1KGTr0']) {
    if (linkedIds.includes(oldId)) throw new Error(`Old video still linked: ${oldId}`);
  }
  console.log('\nDone — 4 YouTube videos replaced.');
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
