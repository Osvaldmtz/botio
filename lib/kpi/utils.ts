import type { KalyoMetricRow, TwilioMetricRow } from '@/lib/kpi/types';
import type { GA4DailyMetric, GA4PageRow, InstagramInsightPoint, InstagramMediaItem, MetaAdsInsight } from '@/lib/kpi/types';

export function aggregateTwilio(rows: TwilioMetricRow[]) {
  return rows.reduce(
    (acc, row) => ({
      total_sent: acc.total_sent + (row.total_sent ?? 0),
      delivered: acc.delivered + (row.delivered ?? 0),
      failed: acc.failed + (row.failed ?? 0),
      undelivered: acc.undelivered + (row.undelivered ?? 0),
      total_cost_usd: acc.total_cost_usd + Number(row.total_cost_usd ?? 0),
    }),
    { total_sent: 0, delivered: 0, failed: 0, undelivered: 0, total_cost_usd: 0 },
  );
}

export type ExecutiveSummaryData = {
  kalyo: KalyoMetricRow | null;
  kalyoHistory: KalyoMetricRow[];
  twilio: TwilioMetricRow[];
  igReach7d: number | null;
  igReachDaily: InstagramInsightPoint[];
  metaSpendToday: number | null;
  landingSessions30d: number | null;
  landingDaily: GA4DailyMetric[];
  errors: Record<string, string>;
};

export type InstagramPageData = {
  followers: number | null;
  insights: InstagramInsightPoint[];
  media: InstagramMediaItem[];
  error: string | null;
};

export type AdsPageData = {
  summary: MetaAdsInsight[];
  daily: MetaAdsInsight[];
  error: string | null;
};

export type WebPageSummary = {
  users: number;
  sessions: number;
  engagementRate: number;
  bounceRate: number;
  avgDuration: number;
};

export type ClarityPageMetrics = {
  realSessions: number;
  botSessions: number;
  botRate: number;
  scrollDepth: number;
  activeTimeSec: number;
  quickBacks: number;
  rageClicks: number;
  deadClicks: number;
};

export type WebPageData = {
  landing: GA4DailyMetric[];
  app: GA4DailyMetric[];
  landingSummary: WebPageSummary;
  appSummary: WebPageSummary;
  landingPages: GA4PageRow[];
  appPages: GA4PageRow[];
  landingChannels: Array<{
    channel: string;
    activeUsers: number;
    sessions: number;
    engagementRate: number;
  }>;
  clarity: ClarityPageMetrics | null;
  clarityError: string | null;
  error: string | null;
};
