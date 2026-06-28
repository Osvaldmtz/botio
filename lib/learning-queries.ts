import type { SupabaseClient } from '@supabase/supabase-js';
import { CONVERSATION_OUTCOMES, outcomeLabel } from '@/lib/conversation-outcome';
import { SALES_CONVERSATIONS_OR, TEAM_MEMBERS_FILTER } from '@/lib/ambassador-filters';

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

function salesLeadFilter(query: ReturnType<SupabaseClient['from']>) {
  return query.or(TEAM_MEMBERS_FILTER).or(SALES_CONVERSATIONS_OR);
}

export async function fetchOutcomeDistribution(
  supabase: SupabaseClient,
): Promise<OutcomeDistributionItem[]> {
  let query = supabase.from('conversations').select('outcome');
  query = salesLeadFilter(query);

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
  query = salesLeadFilter(query);

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

  query = salesLeadFilter(query);

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
