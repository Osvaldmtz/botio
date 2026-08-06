import 'server-only';

import { OAuth2Client } from 'google-auth-library';
import { formatUnknownError } from '@/lib/format-error';
import {
  getActiveCustomerId,
  getLoginCustomerId,
  getMetricsCustomerIds,
} from '@/lib/google-ads-config';
import {
  formatGoogleAdsApiError,
  parseGoogleAdsHttpBody,
  readHttpResponseBody,
  shouldFallbackToComposio,
} from '@/lib/google-ads-http';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildGoogleAdsSummary,
  emptyGoogleAdsSummary,
  type GoogleAdsSummary,
  type GoogleCampaignInsightRaw,
  type GoogleCampaignStatus,
} from '@/lib/google-ads-summary';

const GOOGLE_ADS_API = 'https://googleads.googleapis.com/v25';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const STALE_CACHE_KEY = 'google_ads_campaign_summary_last_30d';
const COMPOSIO_EXECUTE_URL =
  'https://backend.composio.dev/api/v3/tools/execute/GOOGLEADS_SEARCH_STREAM_GAQL';

export {
  getActiveCustomerId,
  getHistoricalCustomerId,
  getLoginCustomerId,
  getMetricsCustomerIds,
  getGoogleAdsConfig,
  GOOGLE_ADS_CUSTOMER_ID,
} from '@/lib/google-ads-config';

/** AW-18345611562 is the gtag conversion label — not a valid Google Ads customer_id. */
const INVALID_CUSTOMER_ID_PREFIX = /^AW-/i;

/**
 * Build Composio GOOGLEADS_* tool arguments with an explicit customer_id.
 * Pass `customer_id` in args for metrics (active vs historical); defaults to active.
 */
export function googleAdsComposioToolArguments(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const candidate = String(args.customer_id ?? getActiveCustomerId());
  if (INVALID_CUSTOMER_ID_PREFIX.test(candidate)) {
    throw new Error(
      `Invalid Google Ads customer_id "${candidate}". AW-* is a gtag conversion label, not a customer_id.`,
    );
  }
  const raw = candidate.replace(/\D/g, '');
  if (!/^\d{10}$/.test(raw)) {
    throw new Error(
      `Invalid Google Ads customer_id "${args.customer_id ?? ''}". Expected 10 digits.`,
    );
  }
  return { ...args, customer_id: raw };
}

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

export {
  formatGoogleAdsApiError,
  parseGoogleAdsHttpBody,
  shouldFallbackToComposio,
} from '@/lib/google-ads-http';

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

/** Direct Google Ads API — only when developer token is approved and OAuth creds exist. */
export function isGoogleAdsOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() &&
      process.env.GOOGLE_ADS_CLIENT_ID?.trim() &&
      process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim() &&
      getActiveCustomerId(),
  );
}

function isGoogleAdsComposioConfigured(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY?.trim());
}

export function isGoogleAdsConfigured(): boolean {
  return isGoogleAdsOAuthConfigured() || isGoogleAdsComposioConfigured();
}

async function readStaleCache<T>(cacheKey: string): Promise<T | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('meta_cache')
    .select('payload')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (!data?.payload) return null;
  return data.payload as T;
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

async function searchGoogleAdsGaqlOAuth(
  query: string,
  customerId: string,
): Promise<GaqlSearchRow[]> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!developerToken) {
    throw new Error('Missing GOOGLE_ADS_DEVELOPER_TOKEN');
  }

  const accessToken = await getGoogleAdsAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const loginCustomerId = getLoginCustomerId();
  if (loginCustomerId) {
    headers['login-customer-id'] = loginCustomerId;
  }

  const res = await fetch(`${GOOGLE_ADS_API}/customers/${customerId}/googleAds:search`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
    next: { revalidate: 0 },
  });

  const { contentType, bodyText } = await readHttpResponseBody(res);
  const json = parseGoogleAdsHttpBody(res.status, contentType, bodyText);
  return (json.results ?? []) as GaqlSearchRow[];
}

function composioResponseError(json: ComposioExecuteResponse, httpStatus: number): string {
  const topLevel = formatUnknownError(json.error ?? json.message);
  const payload = json.data ?? json;
  const nested =
    typeof payload === 'object' && payload && 'error' in payload
      ? formatUnknownError((payload as { error?: unknown }).error)
      : '';
  const message = nested || topLevel;
  if (message && message !== 'undefined') return message;
  return `Composio Google Ads HTTP ${httpStatus}`;
}

async function searchGoogleAdsGaqlComposio(
  query: string,
  customerId: string,
): Promise<GaqlSearchRow[]> {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Missing COMPOSIO_API_KEY for Google Ads');
  }

  const body: Record<string, unknown> = {
    arguments: googleAdsComposioToolArguments({ query, customer_id: customerId }),
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

  const { contentType, bodyText } = await readHttpResponseBody(res);
  let json: ComposioExecuteResponse;
  try {
    if (
      contentType.includes('text/html') ||
      bodyText.trimStart().startsWith('<!DOCTYPE') ||
      bodyText.trimStart().startsWith('<html')
    ) {
      throw new Error(`Composio returned HTML instead of JSON (HTTP ${res.status})`);
    }
    json = JSON.parse(bodyText) as ComposioExecuteResponse;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Composio returned HTML')) {
      throw error;
    }
    throw new Error(`Composio returned invalid JSON (HTTP ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(composioResponseError(json, res.status));
  }

  const payload = json.data ?? json;
  const nestedError =
    typeof payload === 'object' && payload && 'error' in payload
      ? (payload as { error?: unknown }).error
      : undefined;
  if (nestedError) {
    throw new Error(formatUnknownError(nestedError));
  }

  const data =
    typeof payload === 'object' && payload && 'data' in payload
      ? (payload as { data?: ComposioExecuteResponse['data'] }).data
      : (payload as ComposioExecuteResponse['data']);

  return (data?.results ?? []) as GaqlSearchRow[];
}

async function searchGoogleAdsGaqlForCustomer(
  query: string,
  customerId: string,
): Promise<GaqlSearchRow[]> {
  if (isGoogleAdsOAuthConfigured()) {
    try {
      return await searchGoogleAdsGaqlOAuth(query, customerId);
    } catch (error) {
      if (isGoogleAdsComposioConfigured() && shouldFallbackToComposio(error)) {
        console.warn(
          `[google-ads-api] OAuth failed for ${customerId}, falling back to Composio:`,
          formatGoogleAdsApiError(error),
        );
        return searchGoogleAdsGaqlComposio(query, customerId);
      }
      throw error;
    }
  }
  if (isGoogleAdsComposioConfigured()) {
    return searchGoogleAdsGaqlComposio(query, customerId);
  }
  if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()) {
    throw new Error(
      'GOOGLE_ADS_DEVELOPER_TOKEN set but OAuth credentials incomplete (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)',
    );
  }
  throw new Error('Google Ads not configured');
}

/** GAQL against the active (operational) account — use for mutations and single-account reads. */
export async function searchGoogleAdsGaql(query: string): Promise<GaqlSearchRow[]> {
  return searchGoogleAdsGaqlForCustomer(query, getActiveCustomerId());
}

/** GAQL across active + historical accounts — use for rolling metrics (LAST_30_DAYS). */
export async function searchGoogleAdsGaqlMetrics(query: string): Promise<GaqlSearchRow[]> {
  const customerIds = getMetricsCustomerIds();
  const batches = await Promise.all(
    customerIds.map((customerId) => searchGoogleAdsGaqlForCustomer(query, customerId)),
  );
  return batches.flat();
}

function sumCostMicrosFromRows(results: GaqlSearchRow[]): number {
  return results.reduce((sum, row) => {
    const metrics = row.metrics ?? {};
    return sum + toNumber(metrics.costMicros ?? metrics.cost_micros);
  }, 0);
}

/**
 * Fetch Google Ads cost for CAC metrics (Composio or OAuth).
 * Combines active + historical accounts for LAST_30_DAYS; active only for ALL_TIME.
 */
export async function fetchGoogleAdsSpendCop(window: GoogleAdsSpendWindow): Promise<number> {
  const query = `SELECT metrics.cost_micros FROM customer WHERE segments.date DURING ${window}`;
  const results =
    window === 'LAST_30_DAYS'
      ? await searchGoogleAdsGaqlMetrics(query)
      : await searchGoogleAdsGaql(query);
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
 * Merges metrics from active + historical accounts. Cached 4h in meta_cache.
 */
export async function fetchGoogleAdsCampaignSummary(): Promise<GoogleAdsSummary> {
  const cacheKey = STALE_CACHE_KEY;
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

  try {
    const results = await searchGoogleAdsGaqlMetrics(query);
    const insights = parseGaqlRows(results);
    const summary = buildGoogleAdsSummary(insights, new Date().toISOString(), true);
    await writeCache(cacheKey, summary);
    return summary;
  } catch (error) {
    const message = formatGoogleAdsApiError(error);
    const stale = await readStaleCache<GoogleAdsSummary>(cacheKey);
    if (stale) {
      console.warn('[google-ads-api] serving stale cache after API failure:', message);
      return { ...stale, warning: message };
    }
    throw new Error(message);
  }
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
