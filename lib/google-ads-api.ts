import 'server-only';

import { OAuth2Client } from 'google-auth-library';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildGoogleAdsSummary,
  emptyGoogleAdsSummary,
  type GoogleAdsSummary,
  type GoogleCampaignInsightRaw,
  type GoogleCampaignStatus,
} from '@/lib/google-ads-summary';

const GOOGLE_ADS_API = 'https://googleads.googleapis.com/v18';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const COMPOSIO_EXECUTE_URL =
  'https://backend.composio.dev/api/v3/tools/execute/GOOGLEADS_SEARCH_STREAM_GAQL';

export const GOOGLE_ADS_CUSTOMER_ID =
  process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/\D/g, '') || '4356627994';

export type GoogleAdsSpendWindow = 'LAST_30_DAYS' | 'ALL_TIME';

export type { GoogleAdsSummary } from '@/lib/google-ads-summary';

type GaqlSearchRow = {
  campaign?: {
    id?: string;
    name?: string;
    status?: string;
  };
  metrics?: {
    costMicros?: string | number;
    cost_micros?: string | number;
    impressions?: string | number;
    clicks?: string | number;
    conversions?: string | number;
    ctr?: string | number;
  };
};

type GaqlSearchResponse = {
  results?: GaqlSearchRow[];
  error?: { message?: string; code?: number; status?: string };
};

type ComposioExecuteResponse = {
  data?: {
    results?: Array<{ metrics?: GaqlSearchRow['metrics'] }>;
    successful?: boolean;
    error?: string;
  };
  successful?: boolean;
  error?: string;
  message?: string;
};

function toNumber(raw: string | number | undefined | null): number {
  if (raw == null) return 0;
  const n = typeof raw === 'string' ? Number(raw) : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function normalizeCampaignStatus(raw: string | undefined): GoogleCampaignStatus {
  switch (raw) {
    case 'ENABLED':
      return 'ENABLED';
    case 'PAUSED':
      return 'PAUSED';
    case 'REMOVED':
      return 'REMOVED';
    default:
      return 'UNKNOWN';
  }
}

export function isGoogleAdsOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() &&
      process.env.GOOGLE_ADS_CLIENT_ID?.trim() &&
      process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim() &&
      GOOGLE_ADS_CUSTOMER_ID,
  );
}

function isGoogleAdsComposioConfigured(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY?.trim());
}

export function isGoogleAdsConfigured(): boolean {
  return isGoogleAdsOAuthConfigured() || isGoogleAdsComposioConfigured();
}

async function readCache<T>(cacheKey: string): Promise<T | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('meta_cache')
    .select('payload, expires_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (!data?.payload || !data.expires_at) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data.payload as T;
}

async function writeCache(cacheKey: string, payload: unknown, ttlMs = CACHE_TTL_MS): Promise<void> {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  await supabase.from('meta_cache').upsert(
    {
      cache_key: cacheKey,
      payload: payload as Record<string, unknown>,
      cached_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: 'cache_key' },
  );
}

async function getGoogleAdsAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Google Ads OAuth credentials');
  }

  const oauth2 = new OAuth2Client(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  const tokenResponse = await oauth2.getAccessToken();
  const accessToken = tokenResponse.token;
  if (!accessToken) {
    throw new Error('Failed to obtain Google Ads access token');
  }
  return accessToken;
}

function parseGaqlRows(results: GaqlSearchRow[] | undefined): GoogleCampaignInsightRaw[] {
  return (results ?? []).map((row) => {
    const metrics = row.metrics ?? {};
    const costMicros = metrics.costMicros ?? metrics.cost_micros;
    return {
      campaign_id: String(row.campaign?.id ?? ''),
      campaign_name: row.campaign?.name ?? '',
      status: normalizeCampaignStatus(row.campaign?.status),
      spend: toNumber(costMicros) / 1_000_000,
      impressions: toNumber(metrics.impressions),
      clicks: toNumber(metrics.clicks),
      conversions: toNumber(metrics.conversions),
    };
  });
}

async function searchGoogleAdsGaqlOAuth(query: string): Promise<GaqlSearchRow[]> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!developerToken) {
    throw new Error('Missing GOOGLE_ADS_DEVELOPER_TOKEN');
  }

  const accessToken = await getGoogleAdsAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  };

  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/\D/g, '');
  if (loginCustomerId) {
    headers['login-customer-id'] = loginCustomerId;
  }

  const res = await fetch(
    `${GOOGLE_ADS_API}/customers/${GOOGLE_ADS_CUSTOMER_ID}/googleAds:search`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
      next: { revalidate: 0 },
    },
  );

  const json = (await res.json()) as GaqlSearchResponse & { message?: string };
  if (!res.ok) {
    const detail = json.error?.message ?? json.message ?? `Google Ads HTTP ${res.status}`;
    throw new Error(detail);
  }

  return json.results ?? [];
}

async function searchGoogleAdsGaqlComposio(query: string): Promise<GaqlSearchRow[]> {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Missing COMPOSIO_API_KEY for Google Ads');
  }

  const body: Record<string, unknown> = {
    arguments: {
      query,
      customer_id: GOOGLE_ADS_CUSTOMER_ID,
    },
    user_id: process.env.COMPOSIO_USER_ID?.trim() || 'botio-kalyo',
  };

  const connectedAccountId = process.env.COMPOSIO_GOOGLEADS_CONNECTED_ACCOUNT_ID?.trim();
  if (connectedAccountId) {
    body.connected_account_id = connectedAccountId;
  }

  const res = await fetch(COMPOSIO_EXECUTE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
    next: { revalidate: 0 },
  });

  const json = (await res.json()) as ComposioExecuteResponse;
  if (!res.ok) {
    throw new Error(json.error || json.message || `Composio Google Ads HTTP ${res.status}`);
  }

  const payload = json.data ?? json;
  const nestedError =
    typeof payload === 'object' && payload && 'error' in payload
      ? (payload as { error?: string }).error
      : undefined;
  if (nestedError) {
    throw new Error(nestedError);
  }

  const data =
    typeof payload === 'object' && payload && 'data' in payload
      ? (payload as { data?: ComposioExecuteResponse['data'] }).data
      : (payload as ComposioExecuteResponse['data']);

  return (data?.results ?? []).map((row) => ({
    metrics: row.metrics,
  }));
}

async function searchGoogleAdsGaql(query: string): Promise<GaqlSearchRow[]> {
  if (isGoogleAdsOAuthConfigured()) {
    return searchGoogleAdsGaqlOAuth(query);
  }
  if (isGoogleAdsComposioConfigured()) {
    return searchGoogleAdsGaqlComposio(query);
  }
  throw new Error('Google Ads not configured');
}

function sumCostMicrosFromRows(results: GaqlSearchRow[]): number {
  return results.reduce((sum, row) => {
    const metrics = row.metrics ?? {};
    return sum + toNumber(metrics.costMicros ?? metrics.cost_micros);
  }, 0);
}

/**
 * Fetch Google Ads cost for CAC metrics (Composio or OAuth).
 * Returns spend in COP (account currency).
 */
export async function fetchGoogleAdsSpendCop(window: GoogleAdsSpendWindow): Promise<number> {
  const query = `SELECT metrics.cost_micros FROM customer WHERE segments.date DURING ${window}`;
  const results = await searchGoogleAdsGaql(query);
  return sumCostMicrosFromRows(results) / 1_000_000;
}

export async function fetchGoogleAds(): Promise<{
  spend_30d_cop: number;
  spend_alltime_cop: number;
}> {
  const [spend_30d_cop, spend_alltime_cop] = await Promise.all([
    fetchGoogleAdsSpendCop('LAST_30_DAYS'),
    fetchGoogleAdsSpendCop('ALL_TIME'),
  ]);
  return { spend_30d_cop, spend_alltime_cop };
}

/**
 * Campaign-level Google Ads summary (last 30d): spend, CTR, conversions, CPA.
 * Cached 4h in meta_cache. Uses OAuth when configured, else Composio fallback.
 */
export async function fetchGoogleAdsCampaignSummary(): Promise<GoogleAdsSummary> {
  const cacheKey = 'google_ads_campaign_summary_last_30d';
  const cached = await readCache<GoogleAdsSummary>(cacheKey);
  if (cached) return cached;

  if (!isGoogleAdsConfigured()) {
    return emptyGoogleAdsSummary(false);
  }

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
  `.trim();

  const results = await searchGoogleAdsGaql(query);
  const insights = parseGaqlRows(results);
  const summary = buildGoogleAdsSummary(insights, new Date().toISOString(), true);
  await writeCache(cacheKey, summary);
  return summary;
}

/** @deprecated Use fetchGoogleAdsCampaignSummary */
export async function fetchGoogleAdsSummary(): Promise<{
  period: 'last_30d';
  currency: 'COP';
  updated_at: string;
  spend: number;
  clicks: number;
  conversions: number;
  cpa: number | null;
}> {
  const summary = await fetchGoogleAdsCampaignSummary();
  return {
    period: summary.period,
    currency: summary.currency,
    updated_at: summary.updated_at,
    spend: summary.totals.spend,
    clicks: summary.totals.clicks,
    conversions: summary.totals.conversions,
    cpa: summary.totals.cpa,
  };
}
