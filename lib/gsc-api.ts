import 'server-only';
import { google } from 'googleapis';
import { unstable_cache } from 'next/cache';
import { getGscSearchConsoleClient } from '@/lib/gsc-oauth';
import type { GscMetrics, GscPeriodDays } from '@/lib/gsc-types';

export type { GscDailyClick, GscMetrics, GscPeriodDays, GscTopPage, GscTopQuery } from '@/lib/gsc-types';
export { GSC_PERIOD_OPTIONS, parseGscPeriod } from '@/lib/gsc-types';

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
      `La cuenta OAuth no tiene acceso a kalyo.io. Propiedades visibles: ${accessible.join(', ')}. ` +
        'Agrega el usuario de Google OAuth en Search Console → Configuración → Usuarios y permisos.',
    );
  }

  throw new Error(
    'La cuenta OAuth no tiene propiedades en Search Console. ' +
      'Inicia sesión en search.google.com/search-console con la misma cuenta del refresh token, ' +
      'verifica acceso a kalyo.io y regenera GOOGLE_REFRESH_TOKEN si hace falta.',
  );
}

async function fetchGscMetricsRaw(period: GscPeriodDays): Promise<GscMetrics> {
  const searchconsole = getGscSearchConsoleClient();
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
  7: unstable_cache(() => fetchGscMetricsRaw(7), ['gsc-oauth-metrics', '7'], { revalidate: 3600 }),
  14: unstable_cache(() => fetchGscMetricsRaw(14), ['gsc-oauth-metrics', '14'], { revalidate: 3600 }),
  28: unstable_cache(() => fetchGscMetricsRaw(28), ['gsc-oauth-metrics', '28'], { revalidate: 3600 }),
};

export async function getGscMetrics(period: GscPeriodDays = 28): Promise<GscMetrics> {
  return gscCacheByPeriod[period]();
}
