import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PIPELINE_STAGES,
  type PipelineStage,
  normalizeStage,
} from '@/lib/pipeline';
import {
  resolveDateBounds,
  type ConversationSummary,
} from './conversation-queries';

export type PipelineFilters = {
  botId?: string;
  temperature?: 'hot' | 'warm' | 'cold';
  dateRange?: '7d' | '30d' | 'custom' | 'all';
  from?: string;
  to?: string;
};

export type PipelineLead = ConversationSummary & {
  pipeline_stage: PipelineStage;
};

export type PipelineStats = {
  activeLeads: number;
  trialToPaidRate30d: number;
  avgDaysInStage: Record<PipelineStage, number>;
  movedForwardToday: number;
  movedForwardYesterday: number;
};

export async function fetchPipelineLeads(
  supabase: SupabaseClient,
  filters: PipelineFilters,
): Promise<PipelineLead[]> {
  let q = supabase.from('conversation_summary').select('*');

  if (filters.botId) q = q.eq('bot_id', filters.botId);
  if (filters.temperature) q = q.eq('lead_temperature', filters.temperature);

  const dateRange = filters.dateRange ?? 'all';
  if (dateRange === '7d') {
    const bounds = resolveDateBounds({ dateRange: '7d' });
    if (bounds.start) q = q.gte('last_message_at', bounds.start);
  } else if (dateRange === '30d') {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    q = q.gte('last_message_at', since);
  } else if (dateRange === 'custom') {
    const bounds = resolveDateBounds({
      dateRange: 'custom',
      from: filters.from,
      to: filters.to,
    });
    if (bounds.start) q = q.gte('last_message_at', bounds.start);
    if (bounds.end) q = q.lte('last_message_at', bounds.end);
  }

  const { data, error } = await q.order('pipeline_stage_updated_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...(row as ConversationSummary),
    pipeline_stage: normalizeStage((row as { pipeline_stage?: string }).pipeline_stage),
  }));
}

export async function fetchPipelineStats(
  supabase: SupabaseClient,
  botId?: string,
): Promise<PipelineStats> {
  let activeQuery = supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .neq('pipeline_stage', 'lost');

  if (botId) activeQuery = activeQuery.eq('bot_id', botId);
  const { count: activeLeads } = await activeQuery;

  const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const historyQuery = supabase
    .from('pipeline_stage_history')
    .select('conversation_id, from_stage, to_stage, moved_at')
    .gte('moved_at', since30d);

  const { data: history } = await historyQuery;

  const trialIds = new Set<string>();
  const paidFromTrial = new Set<string>();

  for (const row of history ?? []) {
    if (row.to_stage === 'trial') trialIds.add(row.conversation_id);
    if (row.to_stage === 'paid' && trialIds.has(row.conversation_id)) {
      paidFromTrial.add(row.conversation_id);
    }
  }

  const trialToPaidRate30d =
    trialIds.size > 0
      ? Math.round((paidFromTrial.size / trialIds.size) * 10000) / 100
      : 0;

  const avgDaysInStage = Object.fromEntries(
    PIPELINE_STAGES.map((s) => [s, 0]),
  ) as Record<PipelineStage, number>;

  let stageQuery = supabase
    .from('conversations')
    .select('pipeline_stage, pipeline_stage_updated_at');

  if (botId) stageQuery = stageQuery.eq('bot_id', botId);
  const { data: stageRows } = await stageQuery;

  const buckets: Record<string, number[]> = {};
  const now = Date.now();
  for (const row of stageRows ?? []) {
    const stage = normalizeStage(row.pipeline_stage);
    const updated = row.pipeline_stage_updated_at
      ? new Date(row.pipeline_stage_updated_at).getTime()
      : now;
    const days = Math.max(0, (now - updated) / (24 * 3600 * 1000));
    buckets[stage] = buckets[stage] ?? [];
    buckets[stage].push(days);
  }

  for (const stage of PIPELINE_STAGES) {
    const vals = buckets[stage] ?? [];
    avgDaysInStage[stage] =
      vals.length > 0
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
        : 0;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 3600 * 1000);

  const rank = (s: string | null) => {
    const idx = PIPELINE_STAGES.indexOf(normalizeStage(s));
    return idx >= 0 ? idx : 0;
  };

  let movedForwardToday = 0;
  let movedForwardYesterday = 0;

  for (const row of history ?? []) {
    const movedAt = new Date(row.moved_at).getTime();
    const forward = rank(row.to_stage) > rank(row.from_stage);
    if (!forward) continue;
    if (movedAt >= todayStart.getTime()) movedForwardToday += 1;
    else if (movedAt >= yesterdayStart.getTime() && movedAt < todayStart.getTime()) {
      movedForwardYesterday += 1;
    }
  }

  return {
    activeLeads: activeLeads ?? 0,
    trialToPaidRate30d,
    avgDaysInStage,
    movedForwardToday,
    movedForwardYesterday,
  };
}
