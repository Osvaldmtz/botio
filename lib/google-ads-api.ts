import 'server-only';

const COMPOSIO_EXECUTE_URL =
  'https://backend.composio.dev/api/v3/tools/execute/GOOGLEADS_SEARCH_STREAM_GAQL';

export const GOOGLE_ADS_CUSTOMER_ID =
  process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/\D/g, '') || '4356627994';

export type GoogleAdsSpendWindow = 'LAST_30_DAYS' | 'ALL_TIME';

export type GoogleAdsSummary = {
  period: 'last_30d';
  currency: 'COP';
  updated_at: string;
  spend: number;
  clicks: number;
  conversions: number;
  cpa: number | null;
};

type MetricRow = {
  costMicros?: string | number;
  cost_micros?: string | number;
  clicks?: string | number;
  conversions?: string | number;
};

type ComposioExecuteResponse = {
  data?: {
    results?: Array<{
      metrics?: MetricRow;
      customer?: unknown;
    }>;
    successful?: boolean;
    error?: string;
  };
  successful?: boolean;
  error?: string;
  message?: string;
};

function toNumber(raw: string | number | undefined): number {
  if (raw == null) return 0;
  const n = typeof raw === 'string' ? Number(raw) : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function sumMetric(
  results: ComposioExecuteResponse['data'],
  pick: (m: MetricRow) => string | number | undefined,
): number {
  const rows = results?.results ?? [];
  return rows.reduce((sum, row) => sum + toNumber(row.metrics ? pick(row.metrics) : undefined), 0);
}

function sumCostMicros(results: ComposioExecuteResponse['data']): number {
  return sumMetric(results, (m) => m.costMicros ?? m.cost_micros);
}

async function executeGoogleAdsGaql(query: string): Promise<ComposioExecuteResponse['data']> {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Missing COMPOSIO_API_KEY for Google Ads spend');
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

  return data;
}

/**
 * Fetch Google Ads cost via Composio (GOOGLEADS_SEARCH_STREAM_GAQL).
 * Returns spend in COP (account currency) for the given window.
 *
 * Env:
 * - COMPOSIO_API_KEY (required)
 * - COMPOSIO_GOOGLEADS_CONNECTED_ACCOUNT_ID (optional but recommended)
 * - COMPOSIO_USER_ID (optional, default botio-kalyo)
 * - GOOGLE_ADS_CUSTOMER_ID (optional, default 4356627994)
 */
export async function fetchGoogleAdsSpendCop(
  window: GoogleAdsSpendWindow,
): Promise<number> {
  const query = `SELECT metrics.cost_micros FROM customer WHERE segments.date DURING ${window}`;
  const data = await executeGoogleAdsGaql(query);
  return sumCostMicros(data) / 1_000_000;
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

/** Last-30-day Google Ads spend + clicks + conversions (registrations) for channel compare. */
export async function fetchGoogleAdsSummary(): Promise<GoogleAdsSummary> {
  const query = `
    SELECT metrics.cost_micros, metrics.clicks, metrics.conversions
    FROM customer
    WHERE segments.date DURING LAST_30_DAYS
  `.trim();

  const data = await executeGoogleAdsGaql(query);
  const spend = sumCostMicros(data) / 1_000_000;
  const clicks = sumMetric(data, (m) => m.clicks);
  const conversions = sumMetric(data, (m) => m.conversions);

  return {
    period: 'last_30d',
    currency: 'COP',
    updated_at: new Date().toISOString(),
    spend,
    clicks,
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
  };
}
