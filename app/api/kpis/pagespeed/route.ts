import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { getPageSpeedMetrics } from '@/lib/pagespeed-api';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAdmin()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const refresh = new URL(request.url).searchParams.get('refresh') === '1';

  try {
    const metrics = await getPageSpeedMetrics({ skipCache: refresh });
    return Response.json(metrics);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[kpis/pagespeed] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
