import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { processDueEmailJobs } from '@/lib/emailing/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const summary = await processDueEmailJobs(supabase);
    return Response.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[emailing-jobs] cron failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
