import 'server-only';

const COMPOSIO_EXECUTE_URL =
  'https://backend.composio.dev/api/v3/tools/execute/GOOGLEADS_SEARCH_STREAM_GAQL';

export const GOOGLE_ADS_CUSTOMER_ID =
  process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/\D/g, '') || '4356627994';

export type GoogleAdsSpendWindow = 'LAST_30_DAYS' | 'ALL_TIME';

type ComposioExecuteResponse = {
  data?: {
    results?: Array<{
      metrics?: { costMicros?: string | number; cost_micros?: string | number };
      customer?: unknown;
    }>;
    successful?: boolean;
    error?: string;
  };
  successful?: boolean;
  error?: string;
  message?: string;
};

function sumCostMicros(results: ComposioExecuteResponse['data']): number {
  const rows = results?.results ?? [];
  return rows.reduce((sum, row) => {
    const raw = row.metrics?.costMicros ?? row.metrics?.cost_micros ?? 0;
    const n = typeof raw === 'string' ? Number(raw) : Number(raw);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
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
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Missing COMPOSIO_API_KEY for Google Ads spend');
  }

  const query = `SELECT metrics.cost_micros FROM customer WHERE segments.date DURING ${window}`;
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
    throw new Error(
      json.error || json.message || `Composio Google Ads HTTP ${res.status}`,
    );
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

  const micros = sumCostMicros(data);
  return micros / 1_000_000;
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
