import 'server-only';
import { google } from 'googleapis';
import { parseGoogleCredentialsJson } from '@/lib/google-credentials';
import { formatUnknownError } from '@/lib/format-error';
import type {
  GscWeeklyPageRow,
  GscWeeklyQueryRow,
  GscWeeklyReport,
} from '@/lib/weekly-report/types';
import {
  computeWow,
  getPreviousWeeklyDateRange,
  getWeeklyDateRange,
  pctFromRatio,
  roundMetric,
} from '@/lib/weekly-report/wow-utils';

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const DEFAULT_SITE_URL = 'https://kalyo.io/';
const QUERY_FETCH_LIMIT = 100;
const PAGE_FETCH_LIMIT = 50;

type SearchAnalyticsRow = {
  keys?: string[] | null;
  clicks?: number | null;
  impressions?: number | null;
  ctr?: number | null;
  position?: number | null;
};

type GscTotals = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

function getSearchConsoleClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: parseGoogleCredentialsJson(),
    scopes: [SCOPE],
  });
  return google.searchconsole({ version: 'v1', auth });
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
      `La service account no tiene acceso a kalyo.io. Propiedades visibles: ${accessible.join(', ')}.`,
    );
  }

  return DEFAULT_SITE_URL;
}

function mapPageRow(row: SearchAnalyticsRow): GscWeeklyPageRow {
  return {
    page: row.keys?.[0] ?? '',
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: pctFromRatio(row.ctr),
    position: roundMetric(Number(row.position ?? 0), 1),
  };
}

function mapQueryRow(row: SearchAnalyticsRow): GscWeeklyQueryRow {
  return {
    query: row.keys?.[0] ?? '',
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: pctFromRatio(row.ctr),
    position: roundMetric(Number(row.position ?? 0), 1),
  };
}

async function fetchTotalsForRange(
  searchconsole: ReturnType<typeof google.searchconsole>,
  siteUrl: string,
  range: { startDate: string; endDate: string },
): Promise<GscTotals> {
  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: { ...range, dataState: 'all' },
  });
  const row = ((res.data.rows ?? []) as SearchAnalyticsRow[])[0];
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: pctFromRatio(row?.ctr),
    position: roundMetric(Number(row?.position ?? 0), 1),
  };
}

async function fetchPagesForRange(
  searchconsole: ReturnType<typeof google.searchconsole>,
  siteUrl: string,
  range: { startDate: string; endDate: string },
): Promise<GscWeeklyPageRow[]> {
  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      ...range,
      dataState: 'all',
      dimensions: ['page'],
      rowLimit: PAGE_FETCH_LIMIT,
    },
  });
  return ((res.data.rows ?? []) as SearchAnalyticsRow[])
    .map(mapPageRow)
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);
}

async function fetchQueriesForRange(
  searchconsole: ReturnType<typeof google.searchconsole>,
  siteUrl: string,
  range: { startDate: string; endDate: string },
): Promise<GscWeeklyQueryRow[]> {
  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      ...range,
      dataState: 'all',
      dimensions: ['query'],
      rowLimit: QUERY_FETCH_LIMIT,
    },
  });
  return ((res.data.rows ?? []) as SearchAnalyticsRow[])
    .map(mapQueryRow)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);
}

/** GSC metrics for the last 7 days with week-over-week comparison. */
export async function fetchGscWeeklyReport(): Promise<GscWeeklyReport> {
  const range = getWeeklyDateRange();
  const previous_range = getPreviousWeeklyDateRange();
  const updated_at = new Date().toISOString();

  try {
    const searchconsole = getSearchConsoleClient();
    const siteUrl = await resolveSiteUrl(searchconsole);

    const [currentTotals, previousTotals, top_pages_by_clicks, top_queries_by_impressions] =
      await Promise.all([
        fetchTotalsForRange(searchconsole, siteUrl, range),
        fetchTotalsForRange(searchconsole, siteUrl, previous_range),
        fetchPagesForRange(searchconsole, siteUrl, range),
        fetchQueriesForRange(searchconsole, siteUrl, range),
      ]);

    return {
      period: 'last_7d',
      range,
      previous_range,
      totals: {
        clicks: computeWow(currentTotals.clicks, previousTotals.clicks),
        impressions: computeWow(currentTotals.impressions, previousTotals.impressions),
        ctr: computeWow(currentTotals.ctr, previousTotals.ctr),
        position: computeWow(currentTotals.position, previousTotals.position),
      },
      top_pages_by_clicks,
      top_queries_by_impressions,
      updated_at,
    };
  } catch (error) {
    return {
      period: 'last_7d',
      range,
      previous_range,
      totals: {
        clicks: computeWow(0, 0),
        impressions: computeWow(0, 0),
        ctr: computeWow(0, 0),
        position: computeWow(0, 0),
      },
      top_pages_by_clicks: [],
      top_queries_by_impressions: [],
      updated_at,
      error: formatUnknownError(error),
    };
  }
}
