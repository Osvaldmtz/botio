import 'server-only';
import { sendTelegramAlert } from '@/lib/telegram';
import { runTrafficMonitor } from '@/lib/traffic-monitor';
import { createAdminClient } from '@/lib/supabase/admin';

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
    const supabase = createAdminClient();
    const result = await runTrafficMonitor(supabase, sendTelegramAlert);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[cron/traffic-monitor] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
