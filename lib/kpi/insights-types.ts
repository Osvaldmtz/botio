export type KpiInsightsData = {
  kalyo: {
    mrr: number | null;
    active_subscribers: number | null;
    trialing: number | null;
    plan_pro: number | null;
    plan_max: number | null;
    churned_30d: number | null;
    churn_rate: number | null;
    ltv_avg: number | null;
    ltv_cac_ratio: number | null;
  };
  twilio: {
    total_sent: number;
    delivered: number;
    failed: number;
    delivery_rate: number;
    total_cost_usd: number;
  };
  instagram: {
    followers: number | null;
    reach_7d: number;
    impressions_7d: number;
    engagement_7d: number;
    engagement_rate: number;
  };
  metaAds: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    currency?: 'MXN';
  };
  ga4Landing: {
    users: number;
    sessions: number;
    engagement_rate: number;
    bounce_rate: number;
  };
  ga4App: {
    users: number;
    sessions: number;
    engagement_rate: number;
    avg_duration_min: number;
  };
  clarity: {
    realSessions: number;
    botSessions: number;
    botRate: number;
    scrollDepth: number;
    activeTimeSec: number;
    quickBacks: number;
    rageClicks: number;
    deadClicks: number;
  } | null;
  searchConsole: {
    clicks: number;
    impressions: number;
    avgCtr: number;
    avgPosition: number;
    topKeyword: string;
    topKeywordClicks: number;
    topPage: string;
    topPageClicks: number;
  } | null;
  searchConsoleEmpty: boolean;
  fetchedAt: string;
};
