import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { getClarityMetrics } from '@/lib/clarity-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const metrics = await getClarityMetrics(3);
    return Response.json(metrics);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[kpis/clarity] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
