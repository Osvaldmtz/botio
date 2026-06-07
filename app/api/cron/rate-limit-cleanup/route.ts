import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { cleanupOldRateLimitEvents } from '@/lib/rate-limit';

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

  const supabase = createAdminClient();

  try {
    const deleted = await cleanupOldRateLimitEvents(supabase);
    const timestamp = new Date().toISOString();

    console.log('[rate-limit-cleanup] done', { deleted, timestamp });

    return Response.json({ deleted, timestamp });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[rate-limit-cleanup] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
