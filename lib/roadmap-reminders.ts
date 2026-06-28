import type { SupabaseClient } from '@supabase/supabase-js';
import { SALES_CONVERSATIONS_OR, TEAM_MEMBERS_FILTER } from '@/lib/ambassador-filters';
import { getCachedMRR } from '@/lib/stripe-mrr';

export type RoadmapReminderStatus = 'pending' | 'notified' | 'completed' | 'dismissed';
export type RoadmapTriggerType = 'date' | 'metric' | 'both';

export type RoadmapReminderRow = {
  id: string;
  title: string;
  description: string | null;
  trigger_type: RoadmapTriggerType;
  trigger_date: string | null;
  trigger_metric: string | null;
  status: RoadmapReminderStatus;
  notified_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
};

export type MetricEvaluation = {
  metric: string;
  current: number;
  threshold: number;
  met: boolean;
};

export type TriggerCheckResult = {
  shouldNotify: boolean;
  reason: string | null;
  metricEval: MetricEvaluation | null;
  dateMet: boolean;
};

const METRIC_PATTERN = /^([a-z_]+)\s*>=\s*(\d+)$/i;

function salesLeadFilter(query: ReturnType<SupabaseClient['from']>) {
  return query.or(TEAM_MEMBERS_FILTER).or(SALES_CONVERSATIONS_OR);
}

async function countConversationsWithOutcome(supabase: SupabaseClient): Promise<number> {
  let query = supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .not('outcome', 'is', null);
  query = salesLeadFilter(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function countPaidConversions(supabase: SupabaseClient): Promise<number> {
  let query = supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('outcome', 'paid');
  query = salesLeadFilter(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function countActivePaidSubscribers(): Promise<number> {
  const mrr = await getCachedMRR();
  if (!mrr.available) return 0;
  return mrr.active_subscriptions;
}

export async function evaluateRoadmapMetric(
  supabase: SupabaseClient,
  metricExpr: string,
): Promise<MetricEvaluation> {
  const match = metricExpr.trim().match(METRIC_PATTERN);
  if (!match) {
    return { metric: metricExpr, current: 0, threshold: 0, met: false };
  }

  const name = match[1]!.toLowerCase();
  const threshold = parseInt(match[2]!, 10);
  let current = 0;

  switch (name) {
    case 'conversations_with_outcome':
      current = await countConversationsWithOutcome(supabase);
      break;
    case 'paid_conversions':
      current = await countPaidConversions(supabase);
      break;
    case 'active_paid_subscribers':
      current = await countActivePaidSubscribers();
      break;
    default:
      console.warn('[roadmap] unknown metric', name);
  }

  return {
    metric: metricExpr,
    current,
    threshold,
    met: current >= threshold,
  };
}

export function checkReminderTrigger(
  reminder: RoadmapReminderRow,
  metricEval: MetricEvaluation | null,
  now = new Date(),
): TriggerCheckResult {
  const dateMet =
    reminder.trigger_date != null && Date.parse(reminder.trigger_date) <= now.getTime();

  const metricMet = metricEval?.met === true;

  let shouldNotify = false;
  let reason: string | null = null;

  if (reminder.trigger_type === 'date') {
    shouldNotify = dateMet;
    if (dateMet && reminder.trigger_date) {
      reason = `Fecha alcanzada (${formatDateLabel(reminder.trigger_date)})`;
    }
  } else if (reminder.trigger_type === 'metric') {
    shouldNotify = metricMet;
    if (metricMet && metricEval) {
      reason = `Métrica cumplida: ${metricEval.current}/${metricEval.threshold} (${metricEval.metric})`;
    }
  } else {
    shouldNotify = dateMet || metricMet;
    if (dateMet && metricMet && metricEval) {
      reason = `Fecha y métrica cumplidas (${metricEval.current}/${metricEval.threshold})`;
    } else if (dateMet && reminder.trigger_date) {
      reason = `Fecha alcanzada (${formatDateLabel(reminder.trigger_date)})`;
    } else if (metricMet && metricEval) {
      reason = `Métrica cumplida: ${metricEval.current}/${metricEval.threshold}`;
    }
  }

  return { shouldNotify, reason, metricEval, dateMet };
}

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
}

export function formatRoadmapTelegramAlert(
  reminder: RoadmapReminderRow,
  triggerReason: string,
): string {
  return [
    '🔔 Recordatorio ML Roadmap',
    '',
    reminder.title,
    '',
    reminder.description ?? '',
    '',
    `Trigger: ${triggerReason}`,
    '',
    'Ver: botio.dgx.agency/admin/roadmap',
  ].join('\n');
}

export async function fetchPendingRoadmapReminders(
  supabase: SupabaseClient,
): Promise<RoadmapReminderRow[]> {
  const { data, error } = await supabase
    .from('roadmap_reminders')
    .select('*')
    .eq('status', 'pending')
    .order('trigger_date', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as RoadmapReminderRow[];
}

export async function fetchAllRoadmapReminders(
  supabase: SupabaseClient,
): Promise<RoadmapReminderRow[]> {
  const { data, error } = await supabase
    .from('roadmap_reminders')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as RoadmapReminderRow[];
}

export async function markRoadmapReminderNotified(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('roadmap_reminders')
    .update({
      status: 'notified',
      notified_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function completeRoadmapReminder(
  supabase: SupabaseClient,
  id: string,
): Promise<RoadmapReminderRow | null> {
  const { data, error } = await supabase
    .from('roadmap_reminders')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data as RoadmapReminderRow | null;
}

export async function dismissRoadmapReminder(
  supabase: SupabaseClient,
  id: string,
): Promise<RoadmapReminderRow | null> {
  const { data, error } = await supabase
    .from('roadmap_reminders')
    .update({ status: 'dismissed' })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data as RoadmapReminderRow | null;
}

export async function postponeRoadmapReminder(
  supabase: SupabaseClient,
  id: string,
  days = 30,
): Promise<RoadmapReminderRow | null> {
  const { data: existing, error: fetchErr } = await supabase
    .from('roadmap_reminders')
    .select('trigger_date')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!existing) return null;

  const base = existing.trigger_date
    ? new Date(existing.trigger_date as string)
    : new Date();
  const nextDate = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('roadmap_reminders')
    .update({
      trigger_date: nextDate.toISOString(),
      status: 'pending',
      notified_at: null,
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data as RoadmapReminderRow | null;
}

export type CheckRoadmapResult = {
  checked: number;
  notified: number;
  ids: string[];
};

export async function checkRoadmapReminders(
  supabase: SupabaseClient,
  options?: {
    sendTelegramFn?: (text: string) => Promise<{ sent: boolean; error?: string }>;
  },
): Promise<CheckRoadmapResult> {
  const pending = await fetchPendingRoadmapReminders(supabase);
  const notifiedIds: string[] = [];

  for (const reminder of pending) {
    const metricEval = reminder.trigger_metric
      ? await evaluateRoadmapMetric(supabase, reminder.trigger_metric)
      : null;

    const check = checkReminderTrigger(reminder, metricEval);
    if (!check.shouldNotify || !check.reason) continue;

    const text = formatRoadmapTelegramAlert(reminder, check.reason);

    if (options?.sendTelegramFn) {
      await options.sendTelegramFn(text);
    } else {
      const { sendTelegramAlert } = await import('@/lib/telegram');
      await sendTelegramAlert(text);
    }

    await markRoadmapReminderNotified(supabase, reminder.id);
    notifiedIds.push(reminder.id);
    console.log(`[roadmap] notified | id=${reminder.id} | reason=${check.reason}`);
  }

  return {
    checked: pending.length,
    notified: notifiedIds.length,
    ids: notifiedIds,
  };
}

export async function fetchRoadmapWithMetrics(
  supabase: SupabaseClient,
): Promise<Array<RoadmapReminderRow & { metric_progress: MetricEvaluation | null }>> {
  const rows = await fetchAllRoadmapReminders(supabase);
  const enriched = [];

  for (const row of rows) {
    const metric_progress = row.trigger_metric
      ? await evaluateRoadmapMetric(supabase, row.trigger_metric)
      : null;
    enriched.push({ ...row, metric_progress });
  }

  return enriched;
}
