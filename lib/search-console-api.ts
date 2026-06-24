import 'server-only';
import { google } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseGoogleCredentialsJson } from '@/lib/google-credentials';

const CACHE_KEY = 'search_console';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SITE_URL = 'https://kalyo.io/';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

export type SearchConsoleKeyword = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchConsolePage = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchConsoleTotals = {
  clicks: number;
  impressions: number;
  avgCtr: number;
  avgPosition: number;
};

export type SearchConsoleMetrics = {
  keywords: SearchConsoleKeyword[];
  pages: SearchConsolePage[];
  totals: SearchConsoleTotals | null;
  updated_at: string;
  empty?: boolean;
};

type SearchAnalyticsRow = {
  keys?: string[] | null;
  clicks?: number | null;
  impressions?: number | null;
  ctr?: number | null;
  position?: number | null;
};

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: parseGoogleCredentialsJson(),
    scopes: [SCOPE],
  });
}

async function resolveSiteUrl(
  searchconsole: ReturnType<typeof google.searchconsole>,
): Promise<string> {
  const configured = process.env.GSC_SITE_URL?.trim();
  if (configured) return configured;

  const sites = await searchconsole.sites.list();
  const entries = sites.data.siteEntry ?? [];
  const preferred =
    entries.find((s) => s.siteUrl === 'sc-domain:kalyo.io') ??
    entries.find((s) => s.siteUrl === 'https://kalyo.io/') ??
    entries.find((s) => s.siteUrl?.includes('kalyo.io'));
  if (preferred?.siteUrl) return preferred.siteUrl;
  return SITE_URL;
}

function getDateRange28d(): { startDate: string; endDate: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function pct(ctr: number | null | undefined): number {
  return Math.round(Number(ctr ?? 0) * 10000) / 100;
}

function roundPosition(position: number | null | undefined): number {
  return Math.round(Number(position ?? 0) * 10) / 10;
}

function mapKeywordRow(row: SearchAnalyticsRow): SearchConsoleKeyword {
  return {
    query: row.keys?.[0] ?? '',
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: pct(row.ctr),
    position: roundPosition(row.position),
  };
}

function mapPageRow(row: SearchAnalyticsRow): SearchConsolePage {
  return {
    page: row.keys?.[0] ?? '',
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: pct(row.ctr),
    position: roundPosition(row.position),
  };
}

async function readCache(): Promise<SearchConsoleMetrics | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('meta_cache')
    .select('payload, expires_at')
    .eq('cache_key', CACHE_KEY)
    .maybeSingle();

  if (!data?.payload || !data.expires_at) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data.payload as SearchConsoleMetrics;
}

async function writeCache(metrics: SearchConsoleMetrics): Promise<void> {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
  await supabase.from('meta_cache').upsert(
    {
      cache_key: CACHE_KEY,
      payload: metrics as unknown as Record<string, unknown>,
      cached_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: 'cache_key' },
  );
}

async function fetchSearchConsoleRaw(): Promise<SearchConsoleMetrics> {
  const auth = getAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const siteUrl = await resolveSiteUrl(searchconsole);
  const { startDate, endDate } = getDateRange28d();
  const baseRequest = { startDate, endDate, dataState: 'all' as const };

  const [keywordsRes, pagesRes, totalsRes] = await Promise.all([
    searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: { ...baseRequest, dimensions: ['query'], rowLimit: 20 },
    }),
    searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: { ...baseRequest, dimensions: ['page'], rowLimit: 10 },
    }),
    searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: baseRequest,
    }),
  ]);

  const keywordRows = (keywordsRes.data.rows ?? []) as SearchAnalyticsRow[];
  const pageRows = (pagesRes.data.rows ?? []) as SearchAnalyticsRow[];
  const totalRows = (totalsRes.data.rows ?? []) as SearchAnalyticsRow[];

  const hasData =
    keywordRows.length > 0 ||
    pageRows.length > 0 ||
    (totalRows[0]?.clicks ?? 0) > 0 ||
    (totalRows[0]?.impressions ?? 0) > 0;

  if (!hasData) {
    return {
      keywords: [],
      pages: [],
      totals: null,
      updated_at: new Date().toISOString(),
      empty: true,
    };
  }

  const totalRow = totalRows[0];
  return {
    keywords: keywordRows.map(mapKeywordRow).sort((a, b) => b.clicks - a.clicks),
    pages: pageRows.map(mapPageRow).sort((a, b) => b.clicks - a.clicks),
    totals: {
      clicks: totalRow?.clicks ?? 0,
      impressions: totalRow?.impressions ?? 0,
      avgCtr: pct(totalRow?.ctr),
      avgPosition: roundPosition(totalRow?.position),
    },
    updated_at: new Date().toISOString(),
  };
}

export async function getSearchConsoleMetrics(options?: {
  skipCache?: boolean;
}): Promise<SearchConsoleMetrics> {
  if (!options?.skipCache) {
    const cached = await readCache();
    if (cached) return cached;
  }

  const metrics = await fetchSearchConsoleRaw();
  await writeCache(metrics);
  return metrics;
}
