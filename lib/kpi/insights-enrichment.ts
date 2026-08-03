import 'server-only';
import type { ChannelCompareResponse } from '@/lib/ads-channel-compare-types';
import { buildChannelCompareResponse } from '@/lib/ads-channel-compare-build';
import {
  fetchSearchConsolePagePositionDrops,
  getSearchConsoleMetrics,
  type SearchConsoleKeyword,
  type SearchConsolePage,
  type SearchConsolePagePositionDrop,
} from '@/lib/search-console-api';
import { fetchGA4Report } from '@/lib/ga4-api';

export type KpiSeoLandingEntryPage = {
  pagePath: string;
  screenPageViews: number;
  bounce_rate_pct: number;
  avg_duration_sec: number;
};

export type KpiSeoDetail = {
  available: boolean;
  error: string | null;
  keywords: SearchConsoleKeyword[];
  pages: SearchConsolePage[];
  keywords_in_top5: SearchConsoleKeyword[];
  keywords_to_improve: SearchConsoleKeyword[];
  pages_low_ctr: SearchConsolePage[];
  pages_position_drop: SearchConsolePagePositionDrop[];
  landing_entry_pages: KpiSeoLandingEntryPage[];
};

export function emptyKpiSeoDetail(error: string | null = null): KpiSeoDetail {
  return {
    available: false,
    error,
    keywords: [],
    pages: [],
    keywords_in_top5: [],
    keywords_to_improve: [],
    pages_low_ctr: [],
    pages_position_drop: [],
    landing_entry_pages: [],
  };
}

function classifyKeywords(keywords: SearchConsoleKeyword[]): {
  inTop5: SearchConsoleKeyword[];
  toImprove: SearchConsoleKeyword[];
} {
  const inTop5 = keywords.filter((k) => k.position <= 5 && k.impressions >= 10);
  const toImprove = keywords
    .filter((k) => k.position > 5 && k.impressions >= 50)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 8);
  return { inTop5, toImprove };
}

function pickLowCtrPages(pages: SearchConsolePage[], siteAvgCtr: number): SearchConsolePage[] {
  const threshold = siteAvgCtr > 0 ? siteAvgCtr * 0.6 : 1;
  return pages
    .filter((p) => p.impressions >= 100 && p.ctr < threshold)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 8);
}

async function fetchLandingEntryPages(): Promise<KpiSeoLandingEntryPage[]> {
  const propertyId = process.env.GA4_LANDING_PROPERTY_ID ?? '531207061';
  const rows = await fetchGA4Report(
    propertyId,
    ['screenPageViews', 'bounceRate', 'averageSessionDuration'],
    ['pagePath'],
    { startDate: '30daysAgo', endDate: 'today' },
  );

  return rows
    .map((row) => ({
      pagePath: row.pagePath || '/',
      screenPageViews: Number(row.screenPageViews ?? 0) || 0,
      bounce_rate_pct: Math.round(Number(row.bounceRate ?? 0) * 1000) / 10,
      avg_duration_sec: Math.round(Number(row.averageSessionDuration ?? 0)),
    }))
    .filter((row) => row.screenPageViews > 0)
    .sort((a, b) => b.screenPageViews - a.screenPageViews)
    .slice(0, 8);
}

export async function fetchKpiSeoDetail(): Promise<KpiSeoDetail> {
  try {
    const [gsc, positionDrops, landingEntryPages] = await Promise.all([
      getSearchConsoleMetrics(),
      fetchSearchConsolePagePositionDrops(28).catch((error) => {
        console.error('[insights-enrichment] GSC position drops failed', error);
        return [] as SearchConsolePagePositionDrop[];
      }),
      fetchLandingEntryPages().catch((error) => {
        console.error('[insights-enrichment] GA4 landing entry pages failed', error);
        return [] as KpiSeoLandingEntryPage[];
      }),
    ]);

    if (gsc.empty || !gsc.totals) {
      return emptyKpiSeoDetail(gsc.empty ? 'Search Console sin datos aún' : null);
    }

    const { inTop5, toImprove } = classifyKeywords(gsc.keywords);
    const pagesLowCtr = pickLowCtrPages(gsc.pages, gsc.totals.avgCtr);

    return {
      available: true,
      error: null,
      keywords: gsc.keywords.slice(0, 15),
      pages: gsc.pages.slice(0, 10),
      keywords_in_top5: inTop5,
      keywords_to_improve: toImprove,
      pages_low_ctr: pagesLowCtr,
      pages_position_drop: positionDrops,
      landing_entry_pages: landingEntryPages,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[insights-enrichment] fetchKpiSeoDetail failed', error);
    return emptyKpiSeoDetail(message);
  }
}

export async function fetchKpiChannelCompare(): Promise<ChannelCompareResponse | null> {
  try {
    return await buildChannelCompareResponse();
  } catch (error) {
    console.error('[insights-enrichment] fetchKpiChannelCompare failed', error);
    return null;
  }
}
