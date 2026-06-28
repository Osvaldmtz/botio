import type { SupabaseClient } from '@supabase/supabase-js';
import { CONVERSATION_OUTCOMES, outcomeLabel } from '@/lib/conversation-outcome';
import { applySalesConversationFilters } from '@/lib/ambassador-filters';

export type OutcomeDistributionItem = {
  outcome: string;
  label: string;
  count: number;
  percent: number;
};

export type LearningMetrics = {
  total: number;
  with_outcome: number;
  unmarked: number;
  paid: number;
  trial_activated: number;
  lost_total: number;
  conversion_rate: number;
  no_response_rate: number;
  paid_over_trial_rate: number;
};

export type LearningConversationRow = {
  id: string;
  customer_phone: string;
  outcome: string | null;
  outcome_date: string | null;
  outcome_source: string | null;
  last_message_at: string | null;
  lead_score: number | null;
  pipeline_stage: string | null;
  metadata: Record<string, unknown> | null;
};

export async function fetchOutcomeDistribution(
  supabase: SupabaseClient,
): Promise<OutcomeDistributionItem[]> {
  let query = supabase.from('conversations').select('outcome');
  query = applySalesConversationFilters(query);

  const { data, error } = await query;
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const key = (row.outcome as string | null) ?? '__unmarked__';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const total = (data ?? []).length || 1;

  const items: OutcomeDistributionItem[] = [];

  for (const outcome of CONVERSATION_OUTCOMES) {
    const count = counts.get(outcome) ?? 0;
    if (count === 0) continue;
    items.push({
      outcome,
      label: outcomeLabel(outcome),
      count,
      percent: Math.round((count / total) * 1000) / 10,
    });
  }

  const unmarked = counts.get('__unmarked__') ?? 0;
  if (unmarked > 0) {
    items.push({
      outcome: '__unmarked__',
      label: 'Sin marcar',
      count: unmarked,
      percent: Math.round((unmarked / total) * 1000) / 10,
    });
  }

  return items.sort((a, b) => b.count - a.count);
}

export async function fetchLearningMetrics(supabase: SupabaseClient): Promise<LearningMetrics> {
  let query = supabase.from('conversations').select('outcome');
  query = applySalesConversationFilters(query);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const total = rows.length;
  const unmarked = rows.filter((r) => !r.outcome).length;
  const paid = rows.filter((r) => r.outcome === 'paid').length;
  const trial = rows.filter((r) => r.outcome === 'trial_activated').length;
  const lostNoResponse = rows.filter((r) => r.outcome === 'lost_no_response').length;
  const lostTotal = rows.filter(
    (r) => typeof r.outcome === 'string' && r.outcome.startsWith('lost_'),
  ).length;
  const withOutcome = total - unmarked;

  return {
    total,
    with_outcome: withOutcome,
    unmarked,
    paid,
    trial_activated: trial,
    lost_total: lostTotal,
    conversion_rate: total > 0 ? Math.round((paid / total) * 1000) / 10 : 0,
    no_response_rate: total > 0 ? Math.round((lostNoResponse / total) * 1000) / 10 : 0,
    paid_over_trial_rate: trial > 0 ? Math.round((paid / trial) * 1000) / 10 : 0,
  };
}

export async function fetchRecentOutcomeConversations(
  supabase: SupabaseClient,
  options?: {
    limit?: number;
    outcome?: string | null;
    source?: string;
    since?: string;
  },
): Promise<LearningConversationRow[]> {
  const limit = options?.limit ?? 50;

  let query = supabase
    .from('conversations')
    .select(
      'id, customer_phone, outcome, outcome_date, outcome_source, last_message_at, lead_score, pipeline_stage, metadata',
    )
    .order('outcome_date', { ascending: false, nullsFirst: false })
    .order('last_message_at', { ascending: false })
    .limit(limit);

  query = applySalesConversationFilters(query);

  if (options?.outcome === '__unmarked__') {
    query = query.is('outcome', null);
  } else if (options?.outcome) {
    query = query.eq('outcome', options.outcome);
  }

  if (options?.source) {
    query = query.eq('outcome_source', options.source);
  }

  if (options?.since) {
    query = query.gte('outcome_date', options.since);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []) as LearningConversationRow[];
}

export type LearningInsightRow = {
  id: string;
  generated_at: string;
  period_start: string | null;
  period_end: string | null;
  total_conversations: number | null;
  paid_count: number | null;
  trial_count: number | null;
  lost_count: number | null;
  insights: Record<string, unknown> | null;
  applied: boolean;
  applied_at: string | null;
};

export type PeriodStats = {
  total: number;
  won: number;
  lost_no_response: number;
  conversion_rate: number;
  no_response_rate: number;
};

export type PeriodComparison = {
  current: PeriodStats;
  previous: PeriodStats;
  conversion_change: number;
  lost_no_response_change: number;
};

function computePeriodStats(
  rows: Array<{ outcome: string | null }>,
): PeriodStats {
  const total = rows.length;
  const won = rows.filter(
    (r) => r.outcome === 'paid' || r.outcome === 'trial_activated',
  ).length;
  const lostNoResponse = rows.filter((r) => r.outcome === 'lost_no_response').length;

  return {
    total,
    won,
    lost_no_response: lostNoResponse,
    conversion_rate: total > 0 ? Math.round((won / total) * 1000) / 10 : 0,
    no_response_rate: total > 0 ? Math.round((lostNoResponse / total) * 1000) / 10 : 0,
  };
}

export async function fetchPeriodComparison(
  supabase: SupabaseClient,
): Promise<PeriodComparison> {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const currentStart = new Date(now - weekMs).toISOString();
  const previousStart = new Date(now - 2 * weekMs).toISOString();

  let currentQuery = supabase
    .from('conversations')
    .select('outcome')
    .not('outcome', 'is', null)
    .gte('outcome_date', currentStart);
  currentQuery = applySalesConversationFilters(currentQuery);

  let previousQuery = supabase
    .from('conversations')
    .select('outcome')
    .not('outcome', 'is', null)
    .gte('outcome_date', previousStart)
    .lt('outcome_date', currentStart);
  previousQuery = applySalesConversationFilters(previousQuery);

  const [{ data: currentRows, error: cErr }, { data: previousRows, error: pErr }] =
    await Promise.all([currentQuery, previousQuery]);

  if (cErr) throw cErr;
  if (pErr) throw pErr;

  const current = computePeriodStats(currentRows ?? []);
  const previous = computePeriodStats(previousRows ?? []);

  return {
    current,
    previous,
    conversion_change: Math.round((current.conversion_rate - previous.conversion_rate) * 10) / 10,
    lost_no_response_change:
      Math.round((current.no_response_rate - previous.no_response_rate) * 10) / 10,
  };
}

export async function fetchLearningInsights(
  supabase: SupabaseClient,
  options?: { applied?: 'all' | 'applied' | 'pending'; limit?: number },
): Promise<LearningInsightRow[]> {
  const limit = options?.limit ?? 20;

  let query = supabase
    .from('learning_insights')
    .select(
      'id, generated_at, period_start, period_end, total_conversations, paid_count, trial_count, lost_count, insights, applied, applied_at',
    )
    .order('generated_at', { ascending: false })
    .limit(limit);

  if (options?.applied === 'applied') {
    query = query.eq('applied', true);
  } else if (options?.applied === 'pending') {
    query = query.eq('applied', false);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []) as LearningInsightRow[];
}

export async function markLearningInsightApplied(
  supabase: SupabaseClient,
  insightId: string,
): Promise<LearningInsightRow | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('learning_insights')
    .update({ applied: true, applied_at: now })
    .eq('id', insightId)
    .select(
      'id, generated_at, period_start, period_end, total_conversations, paid_count, trial_count, lost_count, insights, applied, applied_at',
    )
    .maybeSingle();

  if (error) throw error;
  return data as LearningInsightRow | null;
}

