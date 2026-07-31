export type ChannelMetricWinner = 'meta' | 'google' | 'tie' | null;

export type ChannelCompareResponse = {
  updated_at: string;
  period: 'last_30d';
  fx: { mxn_per_usd: number; cop_per_usd: number };
  meta: {
    available: boolean;
    error: string | null;
    warning: string | null;
    spend: number;
    spend_usd: number;
    currency: 'MXN';
    clicks: number;
    conversions: number;
    conversion_label: 'conversaciones';
    cpa: number | null;
    cpa_usd: number | null;
  };
  google: {
    available: boolean;
    error: string | null;
    warning: string | null;
    spend: number;
    spend_usd: number;
    currency: 'COP';
    clicks: number;
    conversions: number;
    conversion_label: 'registros';
    cpa: number | null;
    cpa_usd: number | null;
  };
  winners: {
    spend: ChannelMetricWinner;
    conversions: ChannelMetricWinner;
    cpa: ChannelMetricWinner;
  };
};
