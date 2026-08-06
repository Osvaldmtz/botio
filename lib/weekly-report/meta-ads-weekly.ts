import 'server-only';
import {
  buildMetaAdsSummary,
  type MetaAdsSummary,
  type MetaAdsSummaryTotals,
  type MetaCampaignInsightRaw,
  type MetaCampaignStatus,
} from '@/lib/meta-ads-summary';
import { formatUnknownError } from '@/lib/format-error';
import type { MetaAdsWeeklyCampaignRow, MetaAdsWeeklyReport } from '@/lib/weekly-report/types';
import {
  computeWow,
  getPreviousWeeklyDateRange,
  getWeeklyDateRange,
  roundMetric,
} from '@/lib/weekly-report/wow-utils';

const META_GRAPH = 'https://graph.facebook.com/v19.0';

type MetaGraphError = { message: string; type?: string; code?: number };

function getMetaToken(): string {
  const token = process.env.META_ACCESS_TOKEN ?? process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error('Missing META_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN');
  return token;
}

function getAdAccountId(): string {
  return process.env.META_AD_ACCOUNT_ID ?? 'act_1105914435027314';
}

async function fetchMetaCampaignData(
  timeParams: Record<string, string>,
): Promise<{ insights: MetaCampaignInsightRaw[]; statuses: MetaCampaignStatus[] }> {
  const token = getMetaToken();
  const accountId = getAdAccountId();

  const insightParams = new URLSearchParams({
    access_token: token,
    fields:
      'campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,cpm,reach,actions,date_start,date_stop',
    level: 'campaign',
    limit: '200',
    ...timeParams,
  });

  const campaignParams = new URLSearchParams({
    access_token: token,
    fields: 'id,name,effective_status',
    limit: '200',
  });

  const [insightsRes, campaignsRes] = await Promise.all([
    fetch(`${META_GRAPH}/${accountId}/insights?${insightParams}`, { next: { revalidate: 0 } }),
    fetch(`${META_GRAPH}/${accountId}/campaigns?${campaignParams}`, { next: { revalidate: 0 } }),
  ]);

  const insightsJson = (await insightsRes.json()) as {
    data?: MetaCampaignInsightRaw[];
    error?: MetaGraphError;
  };
  const campaignsJson = (await campaignsRes.json()) as {
    data?: MetaCampaignStatus[];
    error?: MetaGraphError;
  };

  if (!insightsRes.ok || insightsJson.error) {
    throw new Error(insightsJson.error?.message ?? `Meta API error (${insightsRes.status})`);
  }

  return {
    insights: insightsJson.data ?? [],
    statuses: campaignsJson.data ?? [],
  };
}

async function fetchMetaSummaryForRange(
  startDate: string,
  endDate: string,
): Promise<MetaAdsSummary> {
  const { insights, statuses } = await fetchMetaCampaignData({
    time_range: JSON.stringify({ since: startDate, until: endDate }),
  });
  return buildMetaAdsSummary(insights, statuses, new Date().toISOString(), 'last_7d');
}

function wowFromMetaTotals(
  current: MetaAdsSummaryTotals,
  previous: MetaAdsSummaryTotals,
): MetaAdsWeeklyReport['totals'] {
  const cpa = (t: MetaAdsSummaryTotals): number => t.cpa ?? 0;
  return {
    spend: computeWow(roundMetric(current.spend), roundMetric(previous.spend)),
    impressions: computeWow(current.impressions, previous.impressions),
    clicks: computeWow(current.clicks, previous.clicks),
    ctr: computeWow(roundMetric(current.ctr, 2), roundMetric(previous.ctr, 2)),
    conversations: computeWow(current.conversations, previous.conversations),
    cpa: computeWow(cpa(current), cpa(previous)),
  };
}

function mapActiveCampaigns(summary: MetaAdsSummary): MetaAdsWeeklyCampaignRow[] {
  return summary.campaigns
    .filter((c) => c.effective_status === 'ACTIVE' || c.spend > 0)
    .map((c) => ({
      campaign_id: c.campaign_id,
      campaign_name: c.campaign_name,
      effective_status: c.effective_status,
      spend: roundMetric(c.spend),
      impressions: c.impressions,
      clicks: c.clicks,
      ctr: roundMetric(c.ctr, 2),
      conversations: c.conversations,
      cpa: c.cpa != null ? roundMetric(c.cpa) : null,
    }));
}

/** Meta Ads last-7d metrics with WoW comparison. */
export async function fetchMetaAdsWeeklyReport(): Promise<MetaAdsWeeklyReport> {
  const range = getWeeklyDateRange();
  const previous_range = getPreviousWeeklyDateRange();
  const updated_at = new Date().toISOString();
  const emptyTotals = {
    spend: computeWow(0, 0),
    impressions: computeWow(0, 0),
    clicks: computeWow(0, 0),
    ctr: computeWow(0, 0),
    conversations: computeWow(0, 0),
    cpa: computeWow(0, 0),
  };

  try {
    const [current, previous] = await Promise.all([
      fetchMetaSummaryForRange(range.startDate, range.endDate),
      fetchMetaSummaryForRange(previous_range.startDate, previous_range.endDate),
    ]);

    return {
      period: 'last_7d',
      currency: 'MXN',
      range,
      previous_range,
      totals: wowFromMetaTotals(current.totals, previous.totals),
      active_campaigns: mapActiveCampaigns(current),
      updated_at,
    };
  } catch (error) {
    return {
      period: 'last_7d',
      currency: 'MXN',
      range,
      previous_range,
      totals: emptyTotals,
      active_campaigns: [],
      updated_at,
      error: formatUnknownError(error),
    };
  }
}
