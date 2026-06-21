import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { getSearchConsoleMetrics } from '@/lib/search-console-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const metrics = await getSearchConsoleMetrics();
    return Response.json(metrics);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[kpis/search-console] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
