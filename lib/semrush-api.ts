import 'server-only';

import { formatUnknownError } from '@/lib/format-error';
import { createAdminClient } from '@/lib/supabase/admin';

export const SEO_SEMRUSH_DOMAIN = 'kalyo.io';

const SEMRUSH_ANALYTICS_API = 'https://api.semrush.com/analytics/v1/';
const COMPOSIO_EXECUTE_URL =
  'https://backend.composio.dev/api/v3/tools/execute/SEMRUSH_BACKLINKS_OVERVIEW';
const CACHE_KEY = 'semrush_domain_overview';

export type SemrushDomainOverview = {
  target: string;
  authority_score: number;
};

export type SeoAuthorityScore = {
  value: number;
  source: 'semrush' | 'dataforseo';
};

export function isSemrushConfigured(): boolean {
  return Boolean(
    process.env.SEMRUSH_API_KEY?.trim() ||
      (process.env.COMPOSIO_API_KEY?.trim() && process.env.COMPOSIO_SEMRUSH_CONNECTED_ACCOUNT_ID?.trim()),
  );
}

function parseSemrushCsvAscore(raw: string): number | null {
  const lines = raw
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;
  if (lines[0]?.toUpperCase().includes('ERROR')) return null;

  const header = lines[0]?.split(';') ?? [];
  const ascoreIndex = header.findIndex((col) => col.toLowerCase() === 'ascore');
  const dataLine = lines.length > 1 ? lines[1] : lines[0];
  const values = dataLine.split(';');

  const rawScore =
    ascoreIndex >= 0 ? values[ascoreIndex] : header[0]?.toLowerCase() === 'ascore' ? values[0] : values[0];

  const score = Number(rawScore);
  return Number.isFinite(score) && score > 0 ? score : null;
}

async function fetchSemrushDomainOverviewDirect(domain: string): Promise<SemrushDomainOverview | null> {
  const apiKey = process.env.SEMRUSH_API_KEY?.trim();
  if (!apiKey) return null;

  const params = new URLSearchParams({
    key: apiKey,
    type: 'backlinks_overview',
    target: domain,
    target_type: 'root_domain',
    export_columns: 'ascore',
  });

  const res = await fetch(`${SEMRUSH_ANALYTICS_API}?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`SEMrush HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const authority_score = parseSemrushCsvAscore(body);
  if (authority_score == null) return null;

  return { target: domain, authority_score };
}

type ComposioExecuteResponse = {
  data?: {
    data?: unknown;
    response_data?: unknown;
    successful?: boolean;
    error?: string;
  };
  successful?: boolean;
  error?: string;
};

function extractComposioSemrushCsv(payload: unknown): string | null {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  for (const key of ['response_data', 'data', 'result', 'output']) {
    const value = record[key];
    if (typeof value === 'string') return value;
  }

  return null;
}

async function fetchSemrushDomainOverviewComposio(domain: string): Promise<SemrushDomainOverview | null> {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  if (!apiKey) return null;

  const body: Record<string, unknown> = {
    arguments: {
      target: domain,
      target_type: 'root_domain',
      export_columns: ['ascore'],
    },
    user_id: process.env.COMPOSIO_USER_ID?.trim() || 'botio-kalyo',
  };

  const connectedAccountId = process.env.COMPOSIO_SEMRUSH_CONNECTED_ACCOUNT_ID?.trim();
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
    cache: 'no-store',
  });

  const responseBody = await res.text();
  let json: ComposioExecuteResponse;
  try {
    json = JSON.parse(responseBody) as ComposioExecuteResponse;
  } catch {
    throw new Error(`Composio SEMrush invalid JSON (HTTP ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(json.error ?? json.data?.error ?? `Composio SEMrush HTTP ${res.status}`);
  }

  const payload = json.data?.data ?? json.data?.response_data ?? json.data;
  const csv = extractComposioSemrushCsv(payload);
  if (!csv) return null;

  const authority_score = parseSemrushCsvAscore(csv);
  if (authority_score == null) return null;

  return { target: domain, authority_score };
}

async function readSemrushCache<T>(key: string): Promise<T | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from('seo_cache').select('data').eq('key', key).maybeSingle();
  if (!data?.data) return null;
  return data.data as T;
}

async function writeSemrushCache(key: string, payload: unknown): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('seo_cache').upsert(
    {
      key,
      data: payload as Record<string, unknown>,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );
}

/** domain_overview equivalent — SEMrush Authority Score (ascore) for a domain. */
export async function fetchSemrushDomainOverview(
  domain: string = SEO_SEMRUSH_DOMAIN,
): Promise<SemrushDomainOverview | null> {
  if (process.env.SEMRUSH_API_KEY?.trim()) {
    try {
      const direct = await fetchSemrushDomainOverviewDirect(domain);
      if (direct) return direct;
    } catch (error) {
      console.error('[semrush-api] direct fetch failed', formatUnknownError(error));
    }
  }

  if (process.env.COMPOSIO_API_KEY?.trim()) {
    try {
      return await fetchSemrushDomainOverviewComposio(domain);
    } catch (error) {
      console.error('[semrush-api] composio fetch failed', formatUnknownError(error));
    }
  }

  return null;
}

export async function syncSemrushDomainOverview(
  domain: string = SEO_SEMRUSH_DOMAIN,
): Promise<SemrushDomainOverview | null> {
  const overview = await fetchSemrushDomainOverview(domain);
  if (overview) {
    await writeSemrushCache(CACHE_KEY, overview);
  }
  return overview;
}

export async function getSemrushDomainOverviewCached(
  domain: string = SEO_SEMRUSH_DOMAIN,
): Promise<SemrushDomainOverview | null> {
  const cached = await readSemrushCache<SemrushDomainOverview>(CACHE_KEY);
  if (cached?.authority_score != null && cached.authority_score > 0) return cached;

  if (!isSemrushConfigured()) return cached;
  return syncSemrushDomainOverview(domain);
}

export function resolveAuthorityScore(
  semrush: SemrushDomainOverview | null | undefined,
  dataforSeoRank: number,
): SeoAuthorityScore {
  const dataforSeoValue = dataforSeoRank > 0 ? Math.min(100, Math.round(dataforSeoRank / 10)) : 0;

  if (semrush?.authority_score != null && semrush.authority_score > 0) {
    return { value: semrush.authority_score, source: 'semrush' };
  }

  return { value: dataforSeoValue, source: 'dataforseo' };
}
