import type { SupabaseClient } from '@supabase/supabase-js';
import { CLOSURE_REASON_UI, type ClosureReason } from '@/lib/conversation-closure-constants';
import {
  fetchAmbassadorMetrics,
  type AmbassadorMetrics,
} from '@/lib/ambassador-admin-queries';
import { SALES_CONVERSATIONS_OR, TEAM_MEMBERS_FILTER } from '@/lib/ambassador-filters';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type FunnelMetrics = {
  leads: number;
  conversations: number;
  qualified: number;
  trials_activated: number;
  paid: number;
  conversion_rates: {
    lead_to_qualified: number;
    qualified_to_trial: number;
    trial_to_paid: number;
    overall: number;
  };
};

export type ChannelStats = {
  leads: number;
  trials: number;
  paid: number;
};

export type ObjectionMetric = {
  type: string;
  label: string;
  count: number;
  conversion_rate: number;
};

export type TrendDay = {
  date: string;
  leads: number;
  trials: number;
  paid: number;
};

export type MetricsBundle = {
  funnel: FunnelMetrics;
  by_channel: Record<string, ChannelStats>;
  top_objections: ObjectionMetric[];
  closure_breakdown: Record<string, number>;
  trends_30d: TrendDay[];
  unattended_hot_leads: number;
  ambassadors: AmbassadorMetrics;
  /** Total conversations in 30d including ambassadors (for before/after reporting). */
  total_conversations_30d_including_ambassadors: number;
};

const OBJECTION_LABELS: Record<string, string> = {
  price: 'Precio',
  thinking: 'Lo va a pensar',
  competition: 'Competencia',
  no_time: 'Sin tiempo',
  not_useful: 'No me sirve',
  few_patients: 'Pocos pacientes',
};

function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.round((num / den) * 1000) / 10;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function last30Days(): string {
  return new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
}

function buildTrendDays(
  convRows: Array<{ created_at: string }>,
  trialRows: Array<{ trial_started_at: string }>,
  paidRows: Array<{ paid_at: string }>,
): TrendDay[] {
  const days: TrendDay[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({
      date: key,
      leads: convRows.filter((r) => dayKey(r.created_at) === key).length,
      trials: trialRows.filter((r) => dayKey(r.trial_started_at) === key).length,
      paid: paidRows.filter((r) => dayKey(r.paid_at) === key).length,
    });
  }
  return days;
}

export async function fetchMetricsBundle(supabase: SupabaseClient): Promise<MetricsBundle> {
  const since = last30Days();

  const [
    convRes,
    convAllRes,
    trialRes,
    objectionRes,
    closureRes,
    hotRes,
    ambassadorConvIdsRes,
    ambassadors,
  ] = await Promise.all([
    supabase
      .from('conversations')
      .select(
        'id, created_at, channel, lead_score, lead_captured, pipeline_stage, closure_reason',
      )
      .gte('created_at', since)
      .or(SALES_CONVERSATIONS_OR)
      .or(TEAM_MEMBERS_FILTER),
    supabase.from('conversations').select('id', { count: 'exact', head: true }).gte('created_at', since),
    supabase
      .from('trial_onboarding_messages')
      .select('id, trial_started_at, upgraded_to_paid_at, conversation_id')
      .gte('trial_started_at', since),
    supabase
      .from('detected_objections')
      .select('objection_type, outcome, conversation_id')
      .gte('detected_at', since),
    supabase
      .from('conversations')
      .select('closure_reason, closed_at')
      .not('closure_reason', 'is', null)
      .gte('closed_at', since)
      .or(SALES_CONVERSATIONS_OR)
      .or(TEAM_MEMBERS_FILTER),
    supabase
      .from('conversation_summary')
      .select('id', { count: 'exact', head: true })
      .gte('lead_score', 70)
      .eq('needs_reply', true)
      .eq('handoff_active', false)
      .is('closed_at', null)
      .or(SALES_CONVERSATIONS_OR)
      .or(TEAM_MEMBERS_FILTER),
    supabase.from('conversations').select('id').eq('is_ambassador', true),
    fetchAmbassadorMetrics(supabase),
  ]);

  if (convRes.error) throw convRes.error;
  if (convAllRes.error) throw convAllRes.error;
  if (trialRes.error) throw trialRes.error;
  if (objectionRes.error) throw objectionRes.error;
  if (closureRes.error) throw closureRes.error;
  if (hotRes.error) throw hotRes.error;
  if (ambassadorConvIdsRes.error) throw ambassadorConvIdsRes.error;

  const ambassadorIds = new Set(
    (ambassadorConvIdsRes.data ?? []).map((row) => row.id as string),
  );

  const convs = convRes.data ?? [];
  const trials = (trialRes.data ?? []).filter(
    (t) => !t.conversation_id || !ambassadorIds.has(t.conversation_id as string),
  );
  const objections = (objectionRes.data ?? []).filter(
    (row) => !row.conversation_id || !ambassadorIds.has(row.conversation_id as string),
  );
  const closures = closureRes.data ?? [];

  const leads = convs.length;
  const qualified = convs.filter(
    (c) =>
      c.lead_captured ||
      (c.lead_score ?? 0) >= 40 ||
      ['qualified', 'trial', 'paid'].includes(c.pipeline_stage ?? ''),
  ).length;
  const trialsActivated = trials.length;
  const paidFromClosure = convs.filter((c) => c.closure_reason === 'converted').length;
  const paidFromPipeline = convs.filter((c) => c.pipeline_stage === 'paid').length;
  const paidFromTrial = trials.filter((t) => t.upgraded_to_paid_at).length;
  const paidIds = new Set<string>();
  for (const c of convs) {
    if (c.closure_reason === 'converted' || c.pipeline_stage === 'paid') {
      paidIds.add(c.id as string);
    }
  }
  for (const t of trials) {
    if (t.upgraded_to_paid_at && t.conversation_id) paidIds.add(t.conversation_id as string);
  }
  const paid = paidIds.size || Math.max(paidFromClosure, paidFromPipeline, paidFromTrial);

  const funnel: FunnelMetrics = {
    leads,
    conversations: leads,
    qualified,
    trials_activated: trialsActivated,
    paid,
    conversion_rates: {
      lead_to_qualified: pct(qualified, leads),
      qualified_to_trial: pct(trialsActivated, qualified),
      trial_to_paid: pct(paid, trialsActivated),
      overall: pct(paid, leads),
    },
  };

  const channels = ['whatsapp', 'webchat', 'telegram'] as const;
  const by_channel: Record<string, ChannelStats> = {};
  for (const ch of channels) {
    const chConvs = convs.filter((c) => (c.channel ?? 'whatsapp') === ch);
    const chTrialIds = new Set(
      trials
        .filter((t) => chConvs.some((c) => c.id === t.conversation_id))
        .map((t) => t.conversation_id),
    );
    const chPaid = chConvs.filter(
      (c) => c.closure_reason === 'converted' || c.pipeline_stage === 'paid',
    ).length;
    by_channel[ch] = {
      leads: chConvs.length,
      trials: chTrialIds.size || trials.filter((t) =>
        chConvs.some((c) => c.id === t.conversation_id),
      ).length,
      paid: chPaid,
    };
  }

  const objectionMap = new Map<string, { total: number; converted: number }>();
  for (const row of objections) {
    const t = row.objection_type as string;
    const cur = objectionMap.get(t) ?? { total: 0, converted: 0 };
    cur.total += 1;
    if (row.outcome === 'converted') cur.converted += 1;
    objectionMap.set(t, cur);
  }

  const top_objections: ObjectionMetric[] = Array.from(objectionMap.entries())
    .map(([type, stats]) => ({
      type,
      label: OBJECTION_LABELS[type] ?? type,
      count: stats.total,
      conversion_rate: pct(stats.converted, stats.total),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const closure_breakdown: Record<string, number> = {};
  for (const row of closures) {
    const reason = (row.closure_reason as string) ?? 'other';
    closure_breakdown[reason] = (closure_breakdown[reason] ?? 0) + 1;
  }
  for (const reason of Object.keys(CLOSURE_REASON_UI) as ClosureReason[]) {
    if (!(reason in closure_breakdown)) closure_breakdown[reason] = 0;
  }

  const paidTrendRows = [
    ...trials
      .filter((t) => t.upgraded_to_paid_at)
      .map((t) => ({ paid_at: t.upgraded_to_paid_at as string })),
    ...closures
      .filter((c) => c.closure_reason === 'converted' && c.closed_at)
      .map((c) => ({ paid_at: c.closed_at as string })),
  ];

  const trends_30d = buildTrendDays(
    convs.map((c) => ({ created_at: c.created_at as string })),
    trials.map((t) => ({ trial_started_at: t.trial_started_at as string })),
    paidTrendRows,
  );

  return {
    funnel,
    by_channel,
    top_objections,
    closure_breakdown,
    trends_30d,
    unattended_hot_leads: hotRes.count ?? 0,
    ambassadors,
    total_conversations_30d_including_ambassadors: convAllRes.count ?? leads,
  };
}
