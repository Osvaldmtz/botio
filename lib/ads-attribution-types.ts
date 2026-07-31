import type { AdChannelBucket } from '@/lib/ad-attribution';

export type ChannelAttributionRow = {
  channel: AdChannelBucket;
  label: string;
  leads: number;
  trials: number;
  paid: number;
  spend_usd: number | null;
  cac_usd: number | null;
  roas: number | null;
};

export type ChannelAttributionResponse = {
  updated_at: string;
  period: 'last_30d';
  rows: ChannelAttributionRow[];
  note?: string;
};

export const CHANNEL_LABELS: Record<AdChannelBucket, string> = {
  meta: 'Meta',
  google: 'Google',
  web: 'Web',
  organic: 'Organic',
};

/** Blended MRR estimate for ROAS (USD). */
export const ATTRIBUTION_MRR_USD = 39;
