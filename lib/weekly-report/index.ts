export type * from '@/lib/weekly-report/types';
export { computeWow, getPreviousWeeklyDateRange, getWeeklyDateRange } from '@/lib/weekly-report/wow-utils';
export { fetchGscWeeklyReport } from '@/lib/weekly-report/gsc-weekly';
export { fetchGoogleAdsWeeklyReport } from '@/lib/weekly-report/google-ads-weekly';
export { fetchMetaAdsWeeklyReport } from '@/lib/weekly-report/meta-ads-weekly';

import { fetchGoogleAdsWeeklyReport } from '@/lib/weekly-report/google-ads-weekly';
import { fetchGscWeeklyReport } from '@/lib/weekly-report/gsc-weekly';
import { fetchMetaAdsWeeklyReport } from '@/lib/weekly-report/meta-ads-weekly';
import type { GoogleAdsWeeklyReport, GscWeeklyReport, MetaAdsWeeklyReport } from '@/lib/weekly-report/types';

export type WeeklyReportFetchersResult = {
  gsc: GscWeeklyReport;
  google_ads: GoogleAdsWeeklyReport;
  meta_ads: MetaAdsWeeklyReport;
  fetched_at: string;
};

/** Parallel fetch of all weekly marketing data sources (Block 1). */
export async function fetchWeeklyReportData(): Promise<WeeklyReportFetchersResult> {
  const [gsc, google_ads, meta_ads] = await Promise.all([
    fetchGscWeeklyReport(),
    fetchGoogleAdsWeeklyReport(),
    fetchMetaAdsWeeklyReport(),
  ]);

  return {
    gsc,
    google_ads,
    meta_ads,
    fetched_at: new Date().toISOString(),
  };
}
