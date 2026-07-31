import { isAdmin } from '@/lib/admin-auth';
import { fetchGoogleAdsCampaignSummary, formatGoogleAdsApiError } from '@/lib/google-ads-api';
import type { GoogleAdsSummary } from '@/lib/google-ads-summary';
import { fetchMetaAdsCampaignSummary } from '@/lib/meta-api';
import { copToUsd, getUsdFxRates, mxnToUsd } from '@/lib/fx-rates';
import { formatUnknownError } from '@/lib/format-error';
import type {
  ChannelCompareResponse,
  ChannelMetricWinner,
} from '@/lib/ads-channel-compare-types';

export type { ChannelCompareResponse } from '@/lib/ads-channel-compare-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pickHigherWinner(
  metaValue: number,
  googleValue: number,
): ChannelMetricWinner {
  if (metaValue <= 0 && googleValue <= 0) return null;
  if (metaValue <= 0) return 'google';
  if (googleValue <= 0) return 'meta';
  if (Math.abs(metaValue - googleValue) < 0.01) return 'tie';
  return metaValue > googleValue ? 'meta' : 'google';
}

function pickLowerCpaWinner(
  metaCpa: number | null,
  googleCpa: number | null,
): ChannelMetricWinner {
  if (metaCpa == null && googleCpa == null) return null;
  if (metaCpa == null) return 'google';
  if (googleCpa == null) return 'meta';
  if (Math.abs(metaCpa - googleCpa) < 0.01) return 'tie';
  return metaCpa < googleCpa ? 'meta' : 'google';
}

function hasGoogleChannelData(summary: GoogleAdsSummary | null): boolean {
  if (!summary?.configured) return false;
  return (
    summary.totals.spend > 0 ||
    summary.totals.impressions > 0 ||
    summary.totals.clicks > 0 ||
    summary.campaigns.length > 0
  );
}

function hasMetaChannelData(
  summary: Awaited<ReturnType<typeof fetchMetaAdsCampaignSummary>> | null,
): boolean {
  if (!summary) return false;
  return (
    summary.totals.spend > 0 ||
    summary.totals.clicks > 0 ||
    summary.totals.conversations > 0 ||
    summary.campaigns.length > 0
  );
}

export async function GET() {
  if (!isAdmin()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const fx = await getUsdFxRates();

    const [metaResult, googleResult] = await Promise.allSettled([
      fetchMetaAdsCampaignSummary('last_30d'),
      fetchGoogleAdsCampaignSummary(),
    ]);

    const metaSummary = metaResult.status === 'fulfilled' ? metaResult.value : null;
    const googleSummary = googleResult.status === 'fulfilled' ? googleResult.value : null;

    const metaAvailable = hasMetaChannelData(metaSummary);
    const googleAvailable = hasGoogleChannelData(googleSummary);

    const metaError =
      metaResult.status === 'rejected' ? formatUnknownError(metaResult.reason) : null;
    const googleError =
      googleResult.status === 'rejected'
        ? formatGoogleAdsApiError(googleResult.reason)
        : googleResult.status === 'fulfilled' && !googleSummary?.configured
          ? 'Google Ads no configurado'
          : null;

    const metaWarning = null;
    const googleWarning =
      googleAvailable && googleSummary?.warning ? googleSummary.warning : null;

    const metaTotals = metaAvailable ? metaSummary!.totals : null;
    const googleTotals = googleAvailable ? googleSummary!.totals : null;

    const metaSpendUsd = metaTotals ? mxnToUsd(metaTotals.spend, fx.mxn_per_usd) : 0;
    const googleSpendUsd = googleTotals ? copToUsd(googleTotals.spend, fx.cop_per_usd) : 0;
    const metaCpaUsd =
      metaTotals && metaTotals.conversations > 0
        ? metaSpendUsd / metaTotals.conversations
        : null;
    const googleCpaUsd =
      googleTotals && googleTotals.conversions > 0
        ? googleSpendUsd / googleTotals.conversions
        : null;

    const body: ChannelCompareResponse = {
      updated_at: new Date().toISOString(),
      period: 'last_30d',
      fx: { mxn_per_usd: fx.mxn_per_usd, cop_per_usd: fx.cop_per_usd },
      meta: {
        available: metaAvailable,
        error: metaError,
        warning: metaWarning,
        spend: metaTotals?.spend ?? 0,
        spend_usd: metaSpendUsd,
        currency: 'MXN',
        clicks: metaTotals?.clicks ?? 0,
        conversions: metaTotals?.conversations ?? 0,
        conversion_label: 'conversaciones',
        cpa: metaTotals?.cpa ?? null,
        cpa_usd: metaCpaUsd,
      },
      google: {
        available: googleAvailable,
        error: googleError,
        warning: googleWarning,
        spend: googleTotals?.spend ?? 0,
        spend_usd: googleSpendUsd,
        currency: 'COP',
        clicks: googleTotals?.clicks ?? 0,
        conversions: googleTotals?.conversions ?? 0,
        conversion_label: 'registros',
        cpa: googleTotals?.cpa ?? null,
        cpa_usd: googleCpaUsd,
      },
      winners: {
        spend: pickHigherWinner(metaSpendUsd, googleSpendUsd),
        conversions: pickHigherWinner(
          metaTotals?.conversations ?? 0,
          googleTotals?.conversions ?? 0,
        ),
        cpa: pickLowerCpaWinner(metaCpaUsd, googleCpaUsd),
      },
    };

    return Response.json(body, {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    const message = formatUnknownError(error);
    console.error('[api/ads/channel-compare] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
