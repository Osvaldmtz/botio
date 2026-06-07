import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { movePipelineStage } from '@/lib/pipeline-utils';

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
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const { data, error } = await supabase
    .from('conversations')
    .select('id, pipeline_stage')
    .lt('last_message_at', cutoff)
    .not('pipeline_stage', 'in', '("paid","lost")');

  if (error) {
    console.error('[pipeline-cleanup] query failed', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  let moved = 0;
  for (const row of data ?? []) {
    try {
      const changed = await movePipelineStage(
        supabase,
        row.id,
        row.pipeline_stage,
        'lost',
        null,
        'cron',
      );
      if (changed) moved += 1;
    } catch (err) {
      console.error('[pipeline-cleanup] failed for', row.id, err);
    }
  }

  console.log(`[pipeline-cleanup] moved ${moved} conversations to lost`);

  return Response.json({ moved, timestamp: new Date().toISOString() });
}
