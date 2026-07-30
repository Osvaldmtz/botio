import { isAdmin } from '@/lib/admin-auth';
import { fetchGoogleAdsSummary } from '@/lib/google-ads-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await fetchGoogleAdsSummary();
    return Response.json(summary, {
      headers: {
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/google-ads/summary] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
