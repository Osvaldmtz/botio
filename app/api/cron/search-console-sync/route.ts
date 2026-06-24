import 'server-only';
import { getSearchConsoleMetrics } from '@/lib/search-console-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const metrics = await getSearchConsoleMetrics({ skipCache: true });
    return Response.json({
      empty: metrics.empty ?? false,
      clicks: metrics.totals?.clicks ?? 0,
      keywords: metrics.keywords.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[cron/search-console-sync] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
