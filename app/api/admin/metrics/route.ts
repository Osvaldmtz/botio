import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMRRCached } from '@/lib/stripe-mrr';
import { fetchMetricsBundle } from '@/lib/metrics-queries';
import { generateInsights } from '@/lib/dashboard-insights';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const [mrr, metrics] = await Promise.all([getMRRCached(), fetchMetricsBundle(supabase)]);
    const insights = generateInsights(metrics, mrr);

    return NextResponse.json({
      mrr,
      funnel: metrics.funnel,
      by_channel: metrics.by_channel,
      top_objections: metrics.top_objections,
      closure_breakdown: metrics.closure_breakdown,
      trends_30d: metrics.trends_30d,
      unattended_hot_leads: metrics.unattended_hot_leads,
      insights,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin/metrics] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
