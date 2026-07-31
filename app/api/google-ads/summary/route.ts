import { isAdmin } from '@/lib/admin-auth';
import { fetchGoogleAdsCampaignSummary } from '@/lib/google-ads-api';

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
    const message = errorMessage(error);
    console.error('[api/google-ads/summary] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
