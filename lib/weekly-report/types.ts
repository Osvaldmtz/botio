/** Shared types for the weekly marketing report. */

export type WeeklyPeriod = 'last_7d';

export type WowNumber = {
  current: number;
  previous: number;
  delta: number;
  delta_pct: number | null;
};

export type DateRange = {
  startDate: string;
  endDate: string;
};

export type GscWeeklyPageRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscWeeklyQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscWeeklyReport = {
  period: WeeklyPeriod;
  range: DateRange;
  previous_range: DateRange;
  totals: {
    clicks: WowNumber;
    impressions: WowNumber;
    ctr: WowNumber;
    position: WowNumber;
  };
  top_pages_by_clicks: GscWeeklyPageRow[];
  top_queries_by_impressions: GscWeeklyQueryRow[];
  updated_at: string;
  error?: string;
};

export type GoogleAdsWeeklyCampaignRow = {
  campaign_id: string;
  campaign_name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  cpa: number | null;
};

export type GoogleAdsWeeklyAccountSlice = {
  customer_id: string;
  totals: {
    spend: WowNumber;
    impressions: WowNumber;
    clicks: WowNumber;
    ctr: WowNumber;
    conversions: WowNumber;
    cpa: WowNumber;
  };
  campaigns: GoogleAdsWeeklyCampaignRow[];
  error?: string;
};

export type GoogleAdsWeeklyReport = {
  period: WeeklyPeriod;
  currency: 'COP';
  range: DateRange;
  previous_range: DateRange;
  customer_ids: string[];
  combined: GoogleAdsWeeklyAccountSlice;
  by_account: GoogleAdsWeeklyAccountSlice[];
  updated_at: string;
  configured: boolean;
  error?: string;
};

export type MetaAdsWeeklyCampaignRow = {
  campaign_id: string;
  campaign_name: string;
  effective_status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversations: number;
  cpa: number | null;
};

export type MetaAdsWeeklyReport = {
  period: WeeklyPeriod;
  currency: 'MXN';
  range: DateRange;
  previous_range: DateRange;
  totals: {
    spend: WowNumber;
    impressions: WowNumber;
    clicks: WowNumber;
    ctr: WowNumber;
    conversations: WowNumber;
    cpa: WowNumber;
  };
  active_campaigns: MetaAdsWeeklyCampaignRow[];
  updated_at: string;
  error?: string;
};

/** Conversions attributed via psychologists.attribution->>'utm_source' = chatgpt. */
export type ChatGPTAdsWeeklyReport = {
  period: WeeklyPeriod;
  range: DateRange;
  previous_range: DateRange;
  registrations: number;
  activations: number;
  previous_registrations: number;
  previous_activations: number;
  updated_at: string;
  error?: string;
};
