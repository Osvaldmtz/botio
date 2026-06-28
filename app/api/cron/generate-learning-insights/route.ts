import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { runLearningAnalysis } from '@/lib/learning-analysis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    const result = await runLearningAnalysis(supabase);
    return Response.json({ ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[generate-learning-insights] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
