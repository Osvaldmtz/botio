import 'server-only';
import { syncSeoMetrics } from '@/lib/dataforseo-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
    const summary = await syncSeoMetrics();

    for (const item of summary.errors) {
      console.error('[cron/seo-sync] DataForSEO call failed', {
        key: item.key,
        error: item.error,
        httpStatus: item.httpStatus,
        responseBody: item.responseBody,
      });
    }

    return Response.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[cron/seo-sync] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
