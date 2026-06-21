import 'server-only';
import { syncTwilioMetrics } from '@/lib/twilio-api';

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
    const summary = await syncTwilioMetrics();
    return Response.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[cron/twilio-sync] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
