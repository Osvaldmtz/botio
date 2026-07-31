import { isAdmin } from '@/lib/admin-auth';
import { fetchGoogleAdsCampaignSummary } from '@/lib/google-ads-api';
import { fetchMetaAdsCampaignSummary } from '@/lib/meta-api';
import { copToUsd, getUsdFxRates, mxnToUsd } from '@/lib/fx-rates';
import type {
  ChannelCompareResponse,
  ChannelMetricWinner,
} from '@/lib/ads-channel-compare-types';

export type { ChannelCompareResponse } from '@/lib/ads-channel-compare-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}

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

    const metaAvailable = metaResult.status === 'fulfilled';
    const googleAvailable =
      googleResult.status === 'fulfilled' && googleResult.value.configured;

    const metaError =
      metaResult.status === 'rejected' ? errorMessage(metaResult.reason) : null;
    const googleError =
      googleResult.status === 'rejected'
        ? errorMessage(googleResult.reason)
        : googleResult.status === 'fulfilled' && !googleResult.value.configured
          ? 'Google Ads no configurado'
          : null;

    const metaTotals = metaAvailable ? metaResult.value.totals : null;
    const googleTotals = googleAvailable ? googleResult.value.totals : null;

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
        'Cache-Control': 'private, max-age=14400, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    const message = errorMessage(error);
    console.error('[api/ads/channel-compare] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
