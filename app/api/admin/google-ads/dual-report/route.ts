import { isAdmin } from '@/lib/admin-auth';
import { fetchGoogleAdsDualAccountReport, formatGoogleAdsApiError } from '@/lib/google-ads-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const report = await fetchGoogleAdsDualAccountReport();
    return Response.json(report);
  } catch (error) {
    const message = formatGoogleAdsApiError(error);
    console.error('[api/admin/google-ads/dual-report] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
