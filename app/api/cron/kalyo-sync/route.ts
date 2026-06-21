import 'server-only';
import { syncKalyoMetrics } from '@/lib/kalyo-metrics';

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
    const summary = await syncKalyoMetrics();
    return Response.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[cron/kalyo-sync] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
