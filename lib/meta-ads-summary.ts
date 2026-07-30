/** Pure helpers for Meta Ads campaign summary (testable without Graph API). */

export const MESSAGING_CONVERSATION_ACTION =
  'onsite_conversion.messaging_conversation_started_7d';

export type MetaAction = {
  action_type: string;
  value: string;
};

export type MetaCampaignInsightRaw = {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  reach?: string;
  actions?: MetaAction[];
  date_start?: string;
  date_stop?: string;
};

export type MetaCampaignStatus = {
  id: string;
  name?: string;
  effective_status?: string;
};

export type MetaCampaignSummaryRow = {
  campaign_id: string;
  campaign_name: string;
  effective_status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  reach: number;
  conversations: number;
  cpa: number | null;
};

export type MetaAdsSummaryTotals = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  reach: number;
  conversations: number;
  cpa: number | null;
};

export type MetaAdsSummary = {
  period: 'last_30d';
  currency: 'MXN';
  updated_at: string;
  totals: MetaAdsSummaryTotals;
  campaigns: MetaCampaignSummaryRow[];
};

function num(value: string | number | undefined | null): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function extractMessagingConversations(actions: MetaAction[] | undefined): number {
  if (!actions?.length) return 0;
  const match = actions.find((a) => a.action_type === MESSAGING_CONVERSATION_ACTION);
  return match ? num(match.value) : 0;
}

export function computeCpa(spend: number, conversations: number): number | null {
  if (conversations <= 0) return null;
  return spend / conversations;
}

export function buildCampaignSummaryRows(
  insights: MetaCampaignInsightRaw[],
  statuses: MetaCampaignStatus[],
): MetaCampaignSummaryRow[] {
  const statusById = new Map(
    statuses.map((s) => [s.id, s.effective_status ?? 'UNKNOWN'] as const),
  );
  const nameById = new Map(
    statuses.filter((s) => s.name).map((s) => [s.id, s.name as string] as const),
  );

  const rows: MetaCampaignSummaryRow[] = insights.map((row) => {
    const campaign_id = row.campaign_id ?? '';
    const spend = num(row.spend);
    const impressions = num(row.impressions);
    const clicks = num(row.clicks);
    const conversations = extractMessagingConversations(row.actions);
    const ctr = row.ctr != null ? num(row.ctr) : impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = row.cpc != null ? num(row.cpc) : clicks > 0 ? spend / clicks : 0;
    const cpm = row.cpm != null ? num(row.cpm) : impressions > 0 ? (spend / impressions) * 1000 : 0;

    return {
      campaign_id,
      campaign_name: row.campaign_name || nameById.get(campaign_id) || campaign_id || 'Sin nombre',
      effective_status: statusById.get(campaign_id) ?? 'UNKNOWN',
      spend,
      impressions,
      clicks,
      ctr,
      cpc,
      cpm,
      reach: num(row.reach),
      conversations,
      cpa: computeCpa(spend, conversations),
    };
  });

  // Include ACTIVE campaigns missing from insights (zero spend period).
  for (const status of statuses) {
    if (status.effective_status !== 'ACTIVE') continue;
    if (rows.some((r) => r.campaign_id === status.id)) continue;
    rows.push({
      campaign_id: status.id,
      campaign_name: status.name || status.id,
      effective_status: 'ACTIVE',
      spend: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      reach: 0,
      conversations: 0,
      cpa: null,
    });
  }

  return rows.sort((a, b) => b.spend - a.spend);
}

export function aggregateMetaAdsTotals(campaigns: MetaCampaignSummaryRow[]): MetaAdsSummaryTotals {
  const spend = campaigns.reduce((s, c) => s + c.spend, 0);
  const impressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const clicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const reach = campaigns.reduce((s, c) => s + c.reach, 0);
  const conversations = campaigns.reduce((s, c) => s + c.conversations, 0);

  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    reach,
    conversations,
    cpa: computeCpa(spend, conversations),
  };
}

export function buildMetaAdsSummary(
  insights: MetaCampaignInsightRaw[],
  statuses: MetaCampaignStatus[],
  updatedAt = new Date().toISOString(),
): MetaAdsSummary {
  const campaigns = buildCampaignSummaryRows(insights, statuses);
  return {
    period: 'last_30d',
    currency: 'MXN',
    updated_at: updatedAt,
    totals: aggregateMetaAdsTotals(campaigns),
    campaigns,
  };
}
