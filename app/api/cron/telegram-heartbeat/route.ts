import 'server-only';
import { sendTelegramAlert } from '@/lib/telegram';
import { buildTelegramHeartbeat } from '@/lib/telegram-heartbeat';
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
    const heartbeat = await buildTelegramHeartbeat(supabase);
    const telegram = await sendTelegramAlert(heartbeat.message);

    if (!telegram.sent) {
      console.error('[cron/telegram-heartbeat] send failed', telegram.error);
      return Response.json(
        { ...heartbeat, telegram_sent: false, error: telegram.error },
        { status: 503 },
      );
    }

    return Response.json({
      ...heartbeat,
      telegram_sent: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[cron/telegram-heartbeat] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
