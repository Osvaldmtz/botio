import { isAdmin } from '@/lib/admin-auth';
import { fetchChannelAttribution } from '@/lib/ad-attribution-queries';
import type { ChannelAttributionResponse } from '@/lib/ads-attribution-types';
import { fetchGoogleAdsCampaignSummary } from '@/lib/google-ads-api';
import { fetchMetaAdsCampaignSummary } from '@/lib/meta-api';
import { copToUsd, getUsdFxRates, mxnToUsd } from '@/lib/fx-rates';
import { formatUnknownError } from '@/lib/format-error';
import { createAdminClient } from '@/lib/supabase/admin';

export type { ChannelAttributionResponse } from '@/lib/ads-attribution-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const fx = await getUsdFxRates();

    const [metaResult, googleResult] = await Promise.allSettled([
      fetchMetaAdsCampaignSummary('last_30d'),
      fetchGoogleAdsCampaignSummary(),
    ]);

    const metaSummary = metaResult.status === 'fulfilled' ? metaResult.value : null;
    const googleSummary = googleResult.status === 'fulfilled' ? googleResult.value : null;

    const metaSpendUsd =
      metaSummary && metaSummary.totals.spend > 0
        ? mxnToUsd(metaSummary.totals.spend, fx.mxn_per_usd)
        : null;
    const googleSpendUsd =
      googleSummary?.configured && googleSummary.totals.spend > 0
        ? copToUsd(googleSummary.totals.spend, fx.cop_per_usd)
        : null;

    const data = await fetchChannelAttribution(supabase, {
      meta_usd: metaSpendUsd ?? undefined,
      google_usd: googleSpendUsd ?? undefined,
    });

    const body: ChannelAttributionResponse & {
      spend_errors?: { meta?: string; google?: string };
    } = {
      ...data,
    };

    if (metaResult.status === 'rejected') {
      body.spend_errors = { ...body.spend_errors, meta: formatUnknownError(metaResult.reason) };
    }
    if (googleResult.status === 'rejected') {
      body.spend_errors = { ...body.spend_errors, google: formatUnknownError(googleResult.reason) };
    }

    return Response.json(body, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[ads/attribution]', error);
    return Response.json(
      { error: formatUnknownError(error) },
      { status: 500 },
    );
  }
}
