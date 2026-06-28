import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRoadmapReminders } from '@/lib/roadmap-reminders';

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
    const result = await checkRoadmapReminders(supabase);
    console.log(`[check-roadmap-reminders] checked=${result.checked} notified=${result.notified}`);
    return Response.json({ ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[check-roadmap-reminders] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
