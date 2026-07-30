import { isAdmin } from '@/lib/admin-auth';
import { fetchGoogleAdsSummary } from '@/lib/google-ads-api';
import { fetchMetaAdsCampaignSummary } from '@/lib/meta-api';
import { copToUsd, getUsdFxRates, mxnToUsd } from '@/lib/fx-rates';
import type { ChannelCompareResponse } from '@/lib/ads-channel-compare-types';

export type { ChannelCompareResponse } from '@/lib/ads-channel-compare-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [meta, google, fx] = await Promise.all([
      fetchMetaAdsCampaignSummary('last_30d'),
      fetchGoogleAdsSummary(),
      getUsdFxRates(),
    ]);

    const metaSpendUsd = mxnToUsd(meta.totals.spend, fx.mxn_per_usd);
    const googleSpendUsd = copToUsd(google.spend, fx.cop_per_usd);
    const metaCpaUsd =
      meta.totals.conversations > 0 ? metaSpendUsd / meta.totals.conversations : null;
    const googleCpaUsd =
      google.conversions > 0 ? googleSpendUsd / google.conversions : null;

    let winner: ChannelCompareResponse['winner'] = null;
    if (metaCpaUsd != null && googleCpaUsd != null) {
      if (Math.abs(metaCpaUsd - googleCpaUsd) < 0.01) winner = 'tie';
      else winner = metaCpaUsd < googleCpaUsd ? 'meta' : 'google';
    } else if (metaCpaUsd != null) {
      winner = 'meta';
    } else if (googleCpaUsd != null) {
      winner = 'google';
    }

    const body: ChannelCompareResponse = {
      updated_at: new Date().toISOString(),
      period: 'last_30d',
      fx: { mxn_per_usd: fx.mxn_per_usd, cop_per_usd: fx.cop_per_usd },
      meta: {
        spend: meta.totals.spend,
        spend_usd: metaSpendUsd,
        currency: 'MXN',
        clicks: meta.totals.clicks,
        conversions: meta.totals.conversations,
        conversion_label: 'conversaciones',
        cpa: meta.totals.cpa,
        cpa_usd: metaCpaUsd,
      },
      google: {
        spend: google.spend,
        spend_usd: googleSpendUsd,
        currency: 'COP',
        clicks: google.clicks,
        conversions: google.conversions,
        conversion_label: 'registros',
        cpa: google.cpa,
        cpa_usd: googleCpaUsd,
      },
      winner,
    };

    return Response.json(body, {
      headers: {
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/ads/channel-compare] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
