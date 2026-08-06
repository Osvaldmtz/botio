import 'server-only';
import {
  fetchGoogleAdsCampaignSummaryForDateRange,
  getMetricsCustomerIds,
  isGoogleAdsConfigured,
} from '@/lib/google-ads-api';
import type { GoogleAdsSummary, GoogleAdsSummaryTotals } from '@/lib/google-ads-summary';
import { formatUnknownError } from '@/lib/format-error';
import type {
  GoogleAdsWeeklyAccountSlice,
  GoogleAdsWeeklyCampaignRow,
  GoogleAdsWeeklyReport,
} from '@/lib/weekly-report/types';
import {
  computeWow,
  getPreviousWeeklyDateRange,
  getWeeklyDateRange,
  roundMetric,
} from '@/lib/weekly-report/wow-utils';

function wowFromTotals(
  current: GoogleAdsSummaryTotals,
  previous: GoogleAdsSummaryTotals,
): GoogleAdsWeeklyAccountSlice['totals'] {
  const wowCpa = (c: GoogleAdsSummaryTotals): number => c.cpa ?? 0;
  return {
    spend: computeWow(roundMetric(current.spend), roundMetric(previous.spend)),
    impressions: computeWow(current.impressions, previous.impressions),
    clicks: computeWow(current.clicks, previous.clicks),
    ctr: computeWow(roundMetric(current.ctr, 2), roundMetric(previous.ctr, 2)),
    conversions: computeWow(roundMetric(current.conversions, 2), roundMetric(previous.conversions, 2)),
    cpa: computeWow(wowCpa(current), wowCpa(previous)),
  };
}

function emptyWowTotals(): GoogleAdsWeeklyAccountSlice['totals'] {
  return {
    spend: computeWow(0, 0),
    impressions: computeWow(0, 0),
    clicks: computeWow(0, 0),
    ctr: computeWow(0, 0),
    conversions: computeWow(0, 0),
    cpa: computeWow(0, 0),
  };
}

function mapCampaignRows(summary: GoogleAdsSummary): GoogleAdsWeeklyCampaignRow[] {
  return summary.campaigns.map((c) => ({
    campaign_id: c.campaign_id,
    campaign_name: c.campaign_name,
    status: c.status,
    spend: roundMetric(c.spend),
    impressions: c.impressions,
    clicks: c.clicks,
    ctr: roundMetric(c.ctr, 2),
    conversions: roundMetric(c.conversions, 2),
    cpa: c.cpa != null ? roundMetric(c.cpa) : null,
  }));
}

async function fetchAccountSlice(
  customerId: string,
  range: { startDate: string; endDate: string },
  previousRange: { startDate: string; endDate: string },
): Promise<GoogleAdsWeeklyAccountSlice> {
  try {
    const [current, previous] = await Promise.all([
      fetchGoogleAdsCampaignSummaryForDateRange(
        range.startDate,
        range.endDate,
        [customerId],
        'last_7d',
      ),
      fetchGoogleAdsCampaignSummaryForDateRange(
        previousRange.startDate,
        previousRange.endDate,
        [customerId],
        'last_7d',
      ),
    ]);

    return {
      customer_id: customerId,
      totals: wowFromTotals(current.totals, previous.totals),
      campaigns: mapCampaignRows(current),
    };
  } catch (error) {
    return {
      customer_id: customerId,
      totals: emptyWowTotals(),
      campaigns: [],
      error: formatUnknownError(error),
    };
  }
}

export async function fetchGoogleAdsWeeklyReport(): Promise<GoogleAdsWeeklyReport> {
  const range = getWeeklyDateRange();
  const previous_range = getPreviousWeeklyDateRange();
  const customer_ids = getMetricsCustomerIds();
  const updated_at = new Date().toISOString();
  const configured = isGoogleAdsConfigured();

  if (!configured) {
    return {
      period: 'last_7d',
      currency: 'COP',
      range,
      previous_range,
      customer_ids,
      combined: {
        customer_id: customer_ids.join('+'),
        totals: emptyWowTotals(),
        campaigns: [],
      },
      by_account: customer_ids.map((id) => ({
        customer_id: id,
        totals: emptyWowTotals(),
        campaigns: [],
      })),
      updated_at,
      configured: false,
      error: 'Google Ads no configurado',
    };
  }

  try {
    const [byAccountSettled, currentCombined, previousCombined] = await Promise.all([
      Promise.allSettled(customer_ids.map((id) => fetchAccountSlice(id, range, previous_range))),
      fetchGoogleAdsCampaignSummaryForDateRange(
        range.startDate,
        range.endDate,
        customer_ids,
        'last_7d',
      ),
      fetchGoogleAdsCampaignSummaryForDateRange(
        previous_range.startDate,
        previous_range.endDate,
        customer_ids,
        'last_7d',
      ),
    ]);

    const by_account = byAccountSettled.map((result, i) =>
      result.status === 'fulfilled'
        ? result.value
        : {
            customer_id: customer_ids[i] ?? 'unknown',
            totals: emptyWowTotals(),
            campaigns: [],
            error: formatUnknownError(result.reason),
          },
    );

    const combined: GoogleAdsWeeklyAccountSlice = {
      customer_id: customer_ids.join('+'),
      totals: wowFromTotals(currentCombined.totals, previousCombined.totals),
      campaigns: mapCampaignRows(currentCombined),
    };

    return {
      period: 'last_7d',
      currency: 'COP',
      range,
      previous_range,
      customer_ids,
      combined,
      by_account,
      updated_at,
      configured: true,
    };
  } catch (error) {
    return {
      period: 'last_7d',
      currency: 'COP',
      range,
      previous_range,
      customer_ids,
      combined: {
        customer_id: customer_ids.join('+'),
        totals: emptyWowTotals(),
        campaigns: [],
        error: formatUnknownError(error),
      },
      by_account: [],
      updated_at,
      configured: true,
      error: formatUnknownError(error),
    };
  }
}
