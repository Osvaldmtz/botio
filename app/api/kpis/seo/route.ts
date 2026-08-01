import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { getSeoKpis } from '@/lib/dataforseo-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // authority_score: SEMrush domain_overview (primary) → DataForSEO rank fallback
    const metrics = await getSeoKpis();
    return Response.json(metrics);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[kpis/seo] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
