import 'server-only';
import { format, subDays } from 'date-fns';
import { createAdminClient } from '@/lib/supabase/admin';
import type { KalyoMetricRow, TwilioMetricRow } from '@/lib/kpi/types';
import {
  fetchMetaAds,
  fetchMetaAdsDaily,
  fetchInstagramFollowerCount,
  fetchInstagramInsights,
  fetchInstagramMedia,
} from '@/lib/meta-api';
import {
  getAppMetrics,
  getChannelBreakdown,
  getLandingMetrics,
  getTopPages,
  summarizeGA4Metrics,
} from '@/lib/ga4-api';
import type {
  ExecutiveSummaryData,
  InstagramPageData,
  AdsPageData,
  WebPageData,
} from '@/lib/kpi/utils';

export type { ExecutiveSummaryData, InstagramPageData, AdsPageData, WebPageData } from '@/lib/kpi/utils';
export { aggregateTwilio } from '@/lib/kpi/utils';

export async function getLatestKalyoMetrics(): Promise<KalyoMetricRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('kalyo_metrics')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as KalyoMetricRow | null;
}

export async function getKalyoMetricsHistory(days: number): Promise<KalyoMetricRow[]> {
  const since = format(subDays(new Date(), days), 'yyyy-MM-dd');
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('kalyo_metrics')
    .select('*')
    .gte('date', since)
    .order('date', { ascending: true });
  return (data ?? []) as KalyoMetricRow[];
}

export async function getTwilioMetrics(days: number): Promise<TwilioMetricRow[]> {
  const since = format(subDays(new Date(), days), 'yyyy-MM-dd');
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('twilio_metrics')
    .select('*')
    .gte('date', since)
    .order('date', { ascending: true });
  return (data ?? []) as TwilioMetricRow[];
}

async function safeFetch<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ label: string; data: T | null; error: string | null }> {
  try {
    const data = await fn();
    return { label, data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[kpi] ${label} failed`, err);
    return { label, data: null, error: message };
  }
}

export async function fetchExecutiveSummary(): Promise<ExecutiveSummaryData> {
  const [kalyoLatest, kalyoHistory, twilio, igInsights, metaToday, landing] = await Promise.all([
    getLatestKalyoMetrics(),
    getKalyoMetricsHistory(30),
    getTwilioMetrics(30),
    safeFetch('instagram_reach', () => fetchInstagramInsights(undefined, 'last_30d')),
    safeFetch('meta_spend_today', () => fetchMetaAds('today')),
    safeFetch('ga4_landing', () => getLandingMetrics(30)),
  ]);

  const errors: Record<string, string> = {};
  if (igInsights.error) errors.instagram = igInsights.error;
  if (metaToday.error) errors.meta = metaToday.error;
  if (landing.error) errors.ga4 = landing.error;

  const igReach7d = (igInsights.data ?? []).slice(-7).reduce((sum, p) => sum + p.reach, 0);
  const metaSpendToday = (metaToday.data ?? []).reduce(
    (sum, row) => sum + Number(row.spend || 0),
    0,
  );
  const landingDaily = landing.data ?? [];
  const landingSessions30d = landingDaily.reduce((sum, d) => sum + d.sessions, 0);

  return {
    kalyo: kalyoLatest,
    kalyoHistory,
    twilio,
    igReach7d: igInsights.data ? igReach7d : null,
    igReachDaily: igInsights.data ?? [],
    metaSpendToday: metaToday.data ? metaSpendToday : null,
    landingSessions30d: landing.data ? landingSessions30d : null,
    landingDaily,
    errors,
  };
}

export async function fetchInstagramPageData(): Promise<InstagramPageData> {
  const [followers, insights, media] = await Promise.all([
    safeFetch('ig_followers', () => fetchInstagramFollowerCount()),
    safeFetch('ig_insights', () => fetchInstagramInsights(undefined, 'last_30d')),
    safeFetch('ig_media', () => fetchInstagramMedia()),
  ]);

  const error = followers.error ?? insights.error ?? media.error ?? null;
  return {
    followers: followers.data,
    insights: insights.data ?? [],
    media: media.data ?? [],
    error,
  };
}

export async function fetchAdsPageData(): Promise<AdsPageData> {
  const [summary, daily] = await Promise.all([
    safeFetch('meta_ads_30d', () => fetchMetaAds('last_30d')),
    safeFetch('meta_ads_daily', () => fetchMetaAdsDaily('last_30d')),
  ]);
  const error = summary.error ?? daily.error ?? null;
  return { summary: summary.data ?? [], daily: daily.data ?? [], error };
}

export async function fetchWebPageData(): Promise<WebPageData> {
  const landingId = process.env.GA4_LANDING_PROPERTY_ID ?? '531207061';
  const appId = process.env.GA4_APP_PROPERTY_ID ?? '539858946';

  const [landing, app, landingPages, appPages, landingChannels] = await Promise.all([
    safeFetch('ga4_landing', () => getLandingMetrics(30)),
    safeFetch('ga4_app', () => getAppMetrics(30)),
    safeFetch('ga4_landing_pages', () => getTopPages(landingId, 30)),
    safeFetch('ga4_app_pages', () => getTopPages(appId, 30)),
    safeFetch('ga4_landing_channels', () => getChannelBreakdown(landingId, 30)),
  ]);

  const landingRows = landing.data ?? [];
  const appRows = app.data ?? [];
  const error =
    landing.error ??
    app.error ??
    landingPages.error ??
    appPages.error ??
    landingChannels.error ??
    null;

  return {
    landing: landingRows,
    app: appRows,
    landingSummary: summarizeGA4Metrics(landingRows),
    appSummary: summarizeGA4Metrics(appRows),
    landingPages: landingPages.data ?? [],
    appPages: appPages.data ?? [],
    landingChannels: landingChannels.data ?? [],
    error,
  };
}
