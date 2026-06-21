export type KpiInsightsData = {
  kalyo: {
    mrr: number | null;
    active_subscribers: number | null;
    trialing: number | null;
    plan_pro: number | null;
    plan_max: number | null;
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
  fetchedAt: string;
};
