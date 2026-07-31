import { isAdmin } from '@/lib/admin-auth';
import { fetchGoogleAdsCampaignSummary, formatGoogleAdsApiError } from '@/lib/google-ads-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await fetchGoogleAdsCampaignSummary();
    return Response.json(summary, {
      headers: {
        'Cache-Control': 'private, max-age=14400, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    const message = formatGoogleAdsApiError(error);
    console.error('[api/google-ads/summary] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
