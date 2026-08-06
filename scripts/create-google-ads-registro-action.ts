#!/usr/bin/env npx tsx
/**
 * Create "Registro" (SIGNUP) conversion action on active Google Ads account.
 * Usage: GOOGLE_ADS_CUSTOMER_ID=4732777525 npx tsx scripts/create-google-ads-registro-action.ts
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

async function gaqlSearch(customerId: string, query: string, token: string) {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!.trim();
  const res = await fetch(`${GOOGLE_ADS_API}/customers/${customerId}/googleAds:search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  const json = JSON.parse(text);
  if (!res.ok) throw new Error(JSON.stringify(json, null, 2));
  return json.results ?? [];
}

async function mutateConversionAction(customerId: string, token: string) {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!.trim();
  const body = {
    operations: [
      {
        create: {
          name: 'Registro',
          category: 'SIGNUP',
          type: 'WEBPAGE',
          status: 'ENABLED',
          countingType: 'ONE_PER_CLICK',
          clickThroughLookbackWindowDays: 90,
          viewThroughLookbackWindowDays: 1,
          includeInConversionsMetric: true,
          primaryForGoal: true,
          origin: 'WEBSITE',
        },
      },
    ],
  };

  const res = await fetch(`${GOOGLE_ADS_API}/customers/${customerId}/conversionActions:mutate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const json = JSON.parse(text);
  if (!res.ok) throw new Error(JSON.stringify(json, null, 2));
  return json;
}

async function main() {
  const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID ?? '4732777525').replace(/\D/g, '');
  console.log(`Customer: ${customerId}`);
  const token = await getAccessToken();

  const existing = await gaqlSearch(
    customerId,
    `SELECT conversion_action.id, conversion_action.name, conversion_action.status, conversion_action.category
     FROM conversion_action WHERE conversion_action.name = 'Registro' AND conversion_action.status != 'REMOVED'`,
    token,
  );

  if (existing.length > 0) {
    console.log('Registro already exists:', JSON.stringify(existing, null, 2));
  } else {
    console.log('Creating Registro conversion action...');
    const result = await mutateConversionAction(customerId, token);
    console.log('Created:', JSON.stringify(result, null, 2));
  }

  const actions = await gaqlSearch(
    customerId,
    `SELECT
       conversion_action.id,
       conversion_action.name,
       conversion_action.status,
       conversion_action.category,
       conversion_action.type,
       conversion_action.tag_snippets
     FROM conversion_action
     WHERE conversion_action.name = 'Registro' AND conversion_action.status != 'REMOVED'`,
    token,
  );
  console.log('\n=== Registro action (with tag snippets) ===');
  console.log(JSON.stringify(actions, null, 2));

  const snippets = actions[0]?.conversionAction?.tagSnippets ?? [];
  for (const s of snippets) {
    if (s.type === 'WEBPAGE' && s.pageFormat === 'HTML' && s.eventSnippet) {
      console.log('\n=== Event snippet (HTML WEBPAGE) ===');
      console.log(s.eventSnippet);
      const match = String(s.eventSnippet).match(/send_to':\s*'([^']+)'/);
      if (match) console.log('\n=== send_to label ===\n', match[1]);
    }
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
