/** Pure helpers for Google Ads campaign summary (testable without API). */

export type GoogleCampaignStatus = 'ENABLED' | 'PAUSED' | 'REMOVED' | 'UNKNOWN';

export type GoogleCampaignInsightRaw = {
  campaign_id: string;
  campaign_name: string;
  status: GoogleCampaignStatus;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
};

export type GoogleCampaignSummaryRow = {
  campaign_id: string;
  campaign_name: string;
  status: GoogleCampaignStatus;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  cpa: number | null;
};

export type GoogleAdsSummaryTotals = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  cpa: number | null;
};

export type GoogleAdsSummary = {
  period: 'last_30d';
  currency: 'COP';
  updated_at: string;
  configured: boolean;
  totals: GoogleAdsSummaryTotals;
  campaigns: GoogleCampaignSummaryRow[];
};

export function computeGoogleCpa(spend: number, conversions: number): number | null {
  if (conversions <= 0) return null;
  return spend / conversions;
}

export function buildGoogleCampaignSummaryRows(
  insights: GoogleCampaignInsightRaw[],
): GoogleCampaignSummaryRow[] {
  const byId = new Map<string, GoogleCampaignInsightRaw>();

  for (const row of insights) {
    const existing = byId.get(row.campaign_id);
    if (existing) {
      existing.spend += row.spend;
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.conversions += row.conversions;
      if (row.status === 'ENABLED') existing.status = 'ENABLED';
    } else {
      byId.set(row.campaign_id, { ...row });
    }
  }

  return Array.from(byId.values())
    .map((row) => {
      const impressions = row.impressions;
      const clicks = row.clicks;
      const spend = row.spend;
      return {
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name || row.campaign_id || 'Sin nombre',
        status: row.status,
        spend,
        impressions,
        clicks,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        conversions: row.conversions,
        cpa: computeGoogleCpa(spend, row.conversions),
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

export function aggregateGoogleAdsTotals(
  campaigns: GoogleCampaignSummaryRow[],
): GoogleAdsSummaryTotals {
  const spend = campaigns.reduce((s, c) => s + c.spend, 0);
  const impressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const clicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const conversions = campaigns.reduce((s, c) => s + c.conversions, 0);

  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    conversions,
    cpa: computeGoogleCpa(spend, conversions),
  };
}

export function buildGoogleAdsSummary(
  insights: GoogleCampaignInsightRaw[],
  updatedAt = new Date().toISOString(),
  configured = true,
): GoogleAdsSummary {
  const campaigns = buildGoogleCampaignSummaryRows(insights);
  return {
    period: 'last_30d',
    currency: 'COP',
    updated_at: updatedAt,
    configured,
    totals: aggregateGoogleAdsTotals(campaigns),
    campaigns,
  };
}

export function emptyGoogleAdsSummary(configured = false): GoogleAdsSummary {
  return buildGoogleAdsSummary([], new Date().toISOString(), configured);
}
