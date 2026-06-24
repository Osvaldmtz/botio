import 'server-only';
import { unstable_cache } from 'next/cache';
import { getGscSearchConsoleClient } from '@/lib/gsc-oauth';

const SITE_URL = 'https://kalyo.io/';

export type GscTopQuery = {
  query: string;
  clicks: number;
  position: number;
};

export type GscTopPage = {
  page: string;
  clicks: number;
  position: number;
};

export type GscDailyClick = {
  date: string;
  clicks: number;
};

export type GscMetrics = {
  clicks_28d: number;
  impressions_28d: number;
  ctr_28d: number;
  position_28d: number;
  top_queries: GscTopQuery[];
  top_pages: GscTopPage[];
  daily_clicks: GscDailyClick[];
  updated_at: string;
};

type SearchAnalyticsRow = {
  keys?: string[] | null;
  clicks?: number | null;
  impressions?: number | null;
  ctr?: number | null;
  position?: number | null;
};

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

async function fetchGscMetricsRaw(): Promise<GscMetrics> {
  const searchconsole = getGscSearchConsoleClient();
  const siteUrl = process.env.GSC_SITE_URL?.trim() || SITE_URL;
  const range28 = getDateRange(28);
  const range7 = getDateRange(7);
  const range14 = getDateRange(14);

  const [totalsRes, queriesRes, pagesRes, dailyRes] = await Promise.all([
    searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: { ...range28, dataState: 'all' },
    }),
    searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        ...range7,
        dataState: 'all',
        dimensions: ['query'],
        rowLimit: 5,
      },
    }),
    searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        ...range7,
        dataState: 'all',
        dimensions: ['page'],
        rowLimit: 5,
      },
    }),
    searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        ...range14,
        dataState: 'all',
        dimensions: ['date'],
        rowLimit: 14,
      },
    }),
  ]);

  const totalRow = ((totalsRes.data.rows ?? []) as SearchAnalyticsRow[])[0];
  const queryRows = (queriesRes.data.rows ?? []) as SearchAnalyticsRow[];
  const pageRows = (pagesRes.data.rows ?? []) as SearchAnalyticsRow[];
  const dailyRows = (dailyRes.data.rows ?? []) as SearchAnalyticsRow[];

  return {
    clicks_28d: totalRow?.clicks ?? 0,
    impressions_28d: totalRow?.impressions ?? 0,
    ctr_28d: pct(totalRow?.ctr),
    position_28d: roundPosition(totalRow?.position),
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

const getGscMetricsCached = unstable_cache(fetchGscMetricsRaw, ['gsc-oauth-metrics'], {
  revalidate: 3600,
});

export async function getGscMetrics(): Promise<GscMetrics> {
  return getGscMetricsCached();
}
