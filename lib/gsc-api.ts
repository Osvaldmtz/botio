import 'server-only';
import { google } from 'googleapis';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseGoogleCredentialsJson } from '@/lib/google-credentials';
import type { GscMetrics, GscPeriodDays } from '@/lib/gsc-types';

export type { GscDailyClick, GscMetrics, GscPeriodDays, GscTopPage, GscTopQuery } from '@/lib/gsc-types';
export { GSC_PERIOD_OPTIONS, parseGscPeriod } from '@/lib/gsc-types';

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const DEFAULT_SITE_URL = 'https://kalyo.io/';
const SEARCH_CONSOLE_CACHE_KEY = 'search_console';
const SEARCH_CONSOLE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

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

function getSearchConsoleClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: parseGoogleCredentialsJson(),
    scopes: [SCOPE],
  });
  return google.searchconsole({ version: 'v1', auth });
}

function getDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
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
    entries.find((s) => s.siteUrl === 'https://kalyo.io') ??
    entries.find((s) => s.siteUrl?.includes('kalyo.io'));

  if (preferred?.siteUrl) return preferred.siteUrl;

  const accessible = entries.map((s) => s.siteUrl).filter(Boolean);
  if (accessible.length > 0) {
    throw new Error(
      `La service account no tiene acceso a kalyo.io. Propiedades visibles: ${accessible.join(', ')}. ` +
        'Agrega botio-analytics@kalyo-production.iam.gserviceaccount.com en Search Console → Usuarios y permisos.',
    );
  }

  return DEFAULT_SITE_URL;
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

async function fetchGscMetricsRaw(period: GscPeriodDays): Promise<GscMetrics> {
  const searchconsole = getSearchConsoleClient();
  const siteUrl = await resolveSiteUrl(searchconsole);
  const range = getDateRange(period);

  const [totalsRes, queriesRes, pagesRes, dailyRes] = await Promise.all([
    searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: { ...range, dataState: 'all' },
    }),
    searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        ...range,
        dataState: 'all',
        dimensions: ['query'],
        rowLimit: 5,
      },
    }),
    searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        ...range,
        dataState: 'all',
        dimensions: ['page'],
        rowLimit: 5,
      },
    }),
    searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        ...range,
        dataState: 'all',
        dimensions: ['date'],
        rowLimit: period,
      },
    }),
  ]);

  const totalRow = ((totalsRes.data.rows ?? []) as SearchAnalyticsRow[])[0];
  const queryRows = (queriesRes.data.rows ?? []) as SearchAnalyticsRow[];
  const pageRows = (pagesRes.data.rows ?? []) as SearchAnalyticsRow[];
  const dailyRows = (dailyRes.data.rows ?? []) as SearchAnalyticsRow[];

  return {
    period_days: period,
    clicks: totalRow?.clicks ?? 0,
    impressions: totalRow?.impressions ?? 0,
    ctr: pct(totalRow?.ctr),
    position: roundPosition(totalRow?.position),
    top_queries: queryRows
      .map((row) => ({
        query: row.keys?.[0] ?? '',
        clicks: row.clicks ?? 0,
        position: roundPosition(row.position),
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5),
    top_pages: pageRows
      .map((row) => ({
        page: row.keys?.[0] ?? '',
        clicks: row.clicks ?? 0,
        position: roundPosition(row.position),
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5),
    daily_clicks: dailyRows
      .map((row) => ({
        date: row.keys?.[0] ?? '',
        clicks: row.clicks ?? 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    updated_at: new Date().toISOString(),
  };
}

const gscCacheByPeriod: Record<GscPeriodDays, () => Promise<GscMetrics>> = {
  7: unstable_cache(() => fetchGscMetricsRaw(7), ['gsc-metrics', '7'], { revalidate: 3600 }),
  14: unstable_cache(() => fetchGscMetricsRaw(14), ['gsc-metrics', '14'], { revalidate: 3600 }),
  28: unstable_cache(() => fetchGscMetricsRaw(28), ['gsc-metrics', '28'], { revalidate: 3600 }),
};

export async function getGscMetrics(period: GscPeriodDays = 28): Promise<GscMetrics> {
  return gscCacheByPeriod[period]();
}

async function readSearchConsoleCache(): Promise<SearchConsoleMetrics | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('meta_cache')
    .select('payload, expires_at')
    .eq('cache_key', SEARCH_CONSOLE_CACHE_KEY)
    .maybeSingle();

  if (!data?.payload || !data.expires_at) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data.payload as SearchConsoleMetrics;
}

async function writeSearchConsoleCache(metrics: SearchConsoleMetrics): Promise<void> {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + SEARCH_CONSOLE_CACHE_TTL_MS).toISOString();
  await supabase.from('meta_cache').upsert(
    {
      cache_key: SEARCH_CONSOLE_CACHE_KEY,
      payload: metrics as unknown as Record<string, unknown>,
      cached_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: 'cache_key' },
  );
}

async function fetchSearchConsoleRaw(): Promise<SearchConsoleMetrics> {
  const searchconsole = getSearchConsoleClient();
  const siteUrl = await resolveSiteUrl(searchconsole);
  const { startDate, endDate } = getDateRange(28);
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
    const cached = await readSearchConsoleCache();
    if (cached) return cached;
  }

  const metrics = await fetchSearchConsoleRaw();
  await writeSearchConsoleCache(metrics);
  return metrics;
}
