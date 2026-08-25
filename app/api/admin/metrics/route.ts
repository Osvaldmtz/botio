import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMRRCached } from '@/lib/stripe-mrr';
import { getManualOnlySubscriberStats } from '@/lib/manual-payments';
import { fetchMetricsBundle } from '@/lib/metrics-queries';
import { generateInsights } from '@/lib/dashboard-insights';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const [mrr, metrics, manual] = await Promise.all([
      getMRRCached(),
      fetchMetricsBundle(supabase),
      getManualOnlySubscriberStats(supabase),
    ]);
    const insights = generateInsights(metrics, mrr);
    const stripeMrr = mrr.available ? mrr.current_mrr_usd : 0;
    const totalMrrUsd = Math.round((stripeMrr + manual.manual_mrr_usd) * 100) / 100;
    const stripeActive = mrr.available ? mrr.active_subscriptions : 0;
    const stripeNew = mrr.available ? mrr.new_subs_this_month : 0;

    return NextResponse.json({
      mrr: {
        ...mrr,
        stripe_mrr_usd: mrr.available ? mrr.current_mrr_usd : 0,
        manual_mrr_usd: manual.manual_mrr_usd,
        total_mrr_usd: totalMrrUsd,
        current_mrr_usd: mrr.available ? totalMrrUsd : mrr.current_mrr_usd,
        stripe_active_subscriptions: stripeActive,
        manual_active_subscriptions: manual.active_count,
        active_subscriptions: stripeActive + manual.active_count,
        stripe_new_subs_this_month: stripeNew,
        manual_new_subs_this_month: manual.new_this_month,
        new_subs_this_month: stripeNew + manual.new_this_month,
      },
      funnel: metrics.funnel,
      by_channel: metrics.by_channel,
      top_objections: metrics.top_objections,
      closure_breakdown: metrics.closure_breakdown,
      trends_30d: metrics.trends_30d,
      unattended_hot_leads: metrics.unattended_hot_leads,
      ambassadors: metrics.ambassadors,
      total_conversations_30d_including_ambassadors:
        metrics.total_conversations_30d_including_ambassadors,
      insights,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as Record<string, unknown>).message)
          : String(error);
    console.error('[admin/metrics] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
