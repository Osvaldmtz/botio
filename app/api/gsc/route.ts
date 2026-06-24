import { isAdmin } from '@/lib/admin-auth';
import { getGscMetrics } from '@/lib/gsc-api';
import { parseGscPeriod } from '@/lib/gsc-types';

export const revalidate = 3600;

export async function GET(request: Request) {
  if (!isAdmin()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const period = parseGscPeriod(new URL(request.url).searchParams.get('days'));

  try {
    const metrics = await getGscMetrics(period);
    return Response.json(metrics, {
      headers: {
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/gsc] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
