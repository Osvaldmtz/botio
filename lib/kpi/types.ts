export type TwilioMetricRow = {
  id: string;
  date: string;
  phone_number: string;
  phone_label: string | null;
  total_sent: number;
  delivered: number;
  failed: number;
  undelivered: number;
  delivery_rate: number | null;
  total_cost_usd: number | null;
  synced_at: string;
};

export type KalyoMetricRow = {
  id: string;
  date: string;
  mrr: number | null;
  active_subscribers: number | null;
  trialing: number | null;
  converted_today: number | null;
  churned_today: number | null;
  plan_pro: number | null;
  plan_max: number | null;
  synced_at: string;
};

export type MetaAdsCurrency = 'MXN';

export type MetaAdsInsight = {
  spend: string;
  impressions: string;
  clicks: string;
  cpm: string;
  cpc: string;
  ctr: string;
  reach: string;
  date_start?: string;
  date_stop?: string;
  /** Ad account currency — act_1105914435027314 operates in MXN */
  currency?: MetaAdsCurrency;
};

export type InstagramInsightPoint = {
  date: string;
  reach: number;
  impressions: number;
  profile_views: number;
  accounts_engaged: number;
};

export type InstagramMediaItem = {
  id: string;
  caption: string | null;
  media_type: string;
  timestamp: string;
  like_count: number;
  comments_count: number;
  reach: number;
  engagement: number;
  saved: number;
  shares: number;
};

export type GA4DailyMetric = {
  date: string;
  users: number;
  sessions: number;
  engagedSessions: number;
  bounceRate: number;
  averageSessionDuration: number;
};

export type GA4PageRow = {
  pagePath: string;
  screenPageViews: number;
  averageSessionDuration: number;
};

export type GA4ChannelRow = {
  channel: string;
  activeUsers: number;
  sessions: number;
  engagementRate: number;
};

export type KpiFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
