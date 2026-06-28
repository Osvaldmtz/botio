import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchLearningMetrics,
  fetchLearningInsights,
  fetchOutcomeDistribution,
  fetchPeriodComparison,
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
  const appliedFilter = searchParams.get('applied') as 'all' | 'applied' | 'pending' | null;

  try {
    const supabase = createAdminClient();
    const [distribution, metrics, conversations, insights, periodComparison] =
      await Promise.all([
      fetchOutcomeDistribution(supabase),
      fetchLearningMetrics(supabase),
      fetchRecentOutcomeConversations(supabase, {
        limit: 50,
        outcome: outcome === 'unmarked' ? '__unmarked__' : outcome,
        source,
        since,
      }),
      fetchLearningInsights(supabase, {
        applied: appliedFilter ?? 'all',
        limit: 20,
      }),
      fetchPeriodComparison(supabase),
    ]);

    return NextResponse.json({
      distribution,
      metrics,
      conversations,
      insights,
      period_comparison: periodComparison,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin/learning] query failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
