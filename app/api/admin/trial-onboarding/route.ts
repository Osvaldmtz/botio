import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type Filter = 'active' | 'expiring' | 'upgraded' | 'unsubscribed' | 'all';

function deriveStatus(row: {
  unsubscribed: boolean;
  upgraded_to_paid_at: string | null;
  trial_ends_at: string;
}): string {
  if (row.unsubscribed) return 'unsubscribed';
  if (row.upgraded_to_paid_at) return 'upgraded';
  if (new Date(row.trial_ends_at).getTime() < Date.now()) return 'expired';
  return 'active';
}

function lastMessageSent(row: {
  day_1_sent_at: string | null;
  day_3_sent_at: string | null;
  day_7_sent_at: string | null;
  day_13_sent_at: string | null;
  day_15_sent_at: string | null;
}): string | null {
  const stamps = [
    row.day_15_sent_at,
    row.day_13_sent_at,
    row.day_7_sent_at,
    row.day_3_sent_at,
    row.day_1_sent_at,
  ].filter(Boolean) as string[];
  return stamps[0] ?? null;
}

export async function GET(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filter = (searchParams.get('filter') ?? 'active') as Filter;

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('trial_onboarding_messages')
    .select('*')
    .order('trial_started_at', { ascending: false })
    .limit(300);

  if (filter === 'active') {
    query = query.eq('unsubscribed', false).is('upgraded_to_paid_at', null).gte('trial_ends_at', now);
  } else if (filter === 'expiring') {
    query = query
      .eq('unsubscribed', false)
      .is('upgraded_to_paid_at', null)
      .gte('trial_ends_at', now)
      .lte('trial_ends_at', in3Days);
  } else if (filter === 'upgraded') {
    query = query.not('upgraded_to_paid_at', 'is', null);
  } else if (filter === 'unsubscribed') {
    query = query.eq('unsubscribed', true);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((row) => {
    const started = new Date(row.trial_started_at as string).getTime();
    const daysPassed = Math.floor((Date.now() - started) / (24 * 60 * 60 * 1000));
    return {
      ...row,
      days_passed: daysPassed,
      status: deriveStatus(row as Parameters<typeof deriveStatus>[0]),
      last_message_sent_at: lastMessageSent(row as Parameters<typeof lastMessageSent>[0]),
    };
  });

  const { data: recent } = await supabase
    .from('trial_onboarding_messages')
    .select('customer_responded, upgraded_to_paid_at, unsubscribed, trial_ends_at')
    .gte('created_at', thirtyDaysAgo);

  const metricsBase = recent ?? [];
  const activeTrials = metricsBase.filter(
    (r) =>
      !r.unsubscribed &&
      !r.upgraded_to_paid_at &&
      new Date(r.trial_ends_at as string).getTime() > Date.now(),
  ).length;
  const upgraded30d = metricsBase.filter((r) => r.upgraded_to_paid_at).length;
  const responded = metricsBase.filter((r) => r.customer_responded).length;
  const unsubscribed = metricsBase.filter((r) => r.unsubscribed).length;
  const conversionRate =
    metricsBase.length > 0 ? Math.round((upgraded30d / metricsBase.length) * 100) : 0;
  const responseRate =
    metricsBase.length > 0 ? Math.round((responded / metricsBase.length) * 100) : 0;
  const unsubscribeRate =
    metricsBase.length > 0 ? Math.round((unsubscribed / metricsBase.length) * 100) : 0;

  return NextResponse.json({
    rows,
    filter,
    metrics: {
      active_trials: activeTrials,
      conversion_rate_30d: conversionRate,
      response_rate_30d: responseRate,
      unsubscribe_rate_30d: unsubscribeRate,
      total_30d: metricsBase.length,
    },
    fetchedAt: now,
  });
}
