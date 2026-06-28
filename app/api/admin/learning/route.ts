import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchLearningMetrics,
  fetchOutcomeDistribution,
  fetchRecentOutcomeConversations,
} from '@/lib/learning-queries';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const outcome = searchParams.get('outcome');
  const source = searchParams.get('source') ?? undefined;
  const since = searchParams.get('since') ?? undefined;

  try {
    const supabase = createAdminClient();
    const [distribution, metrics, conversations] = await Promise.all([
      fetchOutcomeDistribution(supabase),
      fetchLearningMetrics(supabase),
      fetchRecentOutcomeConversations(supabase, {
        limit: 50,
        outcome: outcome === 'unmarked' ? '__unmarked__' : outcome,
        source,
        since,
      }),
    ]);

    return NextResponse.json({
      distribution,
      metrics,
      conversations,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin/learning] query failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
