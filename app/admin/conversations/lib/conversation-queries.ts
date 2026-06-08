import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChannelFilter } from '@/lib/channel-utils';
import type { ClosureReason } from '@/lib/conversation-closure-constants';

const MEXICO_TZ = 'America/Mexico_City';

export type ConversationStatusFilter =
  | 'all'
  | 'hot'
  | 'warm'
  | 'unanswered'
  | 'closed'
  | 'handoff';

export type ClosureFilter =
  | 'all'
  | 'active'
  | 'closed'
  | ClosureReason;

export type DateRangeFilter = 'today' | 'yesterday' | '7d' | 'custom' | 'all';

export type ConversationFilters = {
  botId?: string;
  channel?: ChannelFilter;
  search?: string;
  status?: ConversationStatusFilter;
  closure?: ClosureFilter;
  dateRange?: DateRangeFilter;
  from?: string;
  to?: string;
};

export type ConversationSummary = {
  id: string;
  customer_phone: string;
  channel: string | null;
  session_id: string | null;
  bot_id: string;
  bot_name: string;
  created_at: string;
  lead_captured: boolean;
  is_closed: boolean;
  close_reason: string | null;
  followup_sent: boolean;
  last_message_at: string | null;
  message_count: number;
  last_message_content: string | null;
  last_message_role: string | null;
  needs_reply: boolean;
  lead_score: number | null;
  lead_temperature: string | null;
  lead_country: string | null;
  lead_city: string | null;
  lead_intent: string | null;
  lead_signals: string[] | null;
  enriched_at: string | null;
  handoff_active: boolean;
  handoff_taken_by: string | null;
  handoff_started_at: string | null;
  pipeline_stage: string | null;
  pipeline_stage_updated_at: string | null;
  pipeline_stage_updated_by: string | null;
  closed_at: string | null;
  closure_reason: string | null;
  closure_note: string | null;
  closed_by: string | null;
};

export type DashboardStats = {
  conversationsToday: number;
  hotLeadsToday: number;
  activeLastHour: number;
  unanswered: number;
  conversionRate: number;
};

export type ConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  source: string | null;
  source_type: string | null;
  metadata: Record<string, unknown> | null;
};

export type ConversationDetail = ConversationSummary & {
  messages: ConversationMessage[];
};

function formatMexicoDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: MEXICO_TZ }).format(date);
}

function mexicoDayBounds(dateStr: string): { start: string; end: string } {
  let startMs: number | null = null;
  let endMs: number | null = null;
  const probeStart = Date.parse(`${dateStr}T05:00:00.000Z`) - 14 * 3600 * 1000;

  for (let ms = probeStart; ms < probeStart + 52 * 3600 * 1000; ms += 60_000) {
    const d = new Date(ms);
    if (formatMexicoDate(d) !== dateStr) continue;
    if (startMs === null) startMs = ms;
    endMs = ms + 60_000 - 1;
  }

  if (startMs === null || endMs === null) {
    throw new Error(`Invalid date: ${dateStr}`);
  }

  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  };
}

export function resolveDateBounds(filters: ConversationFilters): {
  start?: string;
  end?: string;
} {
  const range = filters.dateRange ?? 'all';
  if (range === 'all') return {};

  const now = new Date();
  const today = formatMexicoDate(now);

  if (range === 'today') {
    const { start, end } = mexicoDayBounds(today);
    return { start, end };
  }

  if (range === 'yesterday') {
    const yesterdayMs = Date.parse(mexicoDayBounds(today).start) - 24 * 3600 * 1000;
    const yesterday = formatMexicoDate(new Date(yesterdayMs));
    const { start, end } = mexicoDayBounds(yesterday);
    return { start, end };
  }

  if (range === '7d') {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    return { start: sevenDaysAgo.toISOString() };
  }

  if (range === 'custom') {
    const bounds: { start?: string; end?: string } = {};
    if (filters.from) bounds.start = mexicoDayBounds(filters.from).start;
    if (filters.to) bounds.end = mexicoDayBounds(filters.to).end;
    return bounds;
  }

  return {};
}

export async function fetchConversations(
  supabase: SupabaseClient,
  filters: ConversationFilters,
): Promise<ConversationSummary[]> {
  let q = supabase.from('conversation_summary').select('*');

  if (filters.botId) {
    q = q.eq('bot_id', filters.botId);
  }

  const channel = filters.channel ?? 'all';
  if (channel !== 'all') {
    q = q.eq('channel', channel);
  }

  const status = filters.status ?? 'all';
  if (status === 'hot') q = q.eq('lead_temperature', 'hot');
  if (status === 'warm') q = q.eq('lead_temperature', 'warm');
  if (status === 'unanswered') q = q.eq('needs_reply', true);
  if (status === 'closed') q = q.eq('is_closed', true);
  if (status === 'handoff') q = q.eq('handoff_active', true);

  const closure = filters.closure ?? 'all';
  if (closure === 'active') q = q.is('closed_at', null);
  if (closure === 'closed') q = q.not('closed_at', 'is', null);
  if (
    closure !== 'all' &&
    closure !== 'active' &&
    closure !== 'closed'
  ) {
    q = q.eq('closure_reason', closure);
  }

  const { start, end } = resolveDateBounds(filters);
  if (start) q = q.gte('last_message_at', start);
  if (end) q = q.lte('last_message_at', end);

  const search = filters.search?.trim();
  if (search) {
    const term = `%${search}%`;
    q = q.or(
      `customer_phone.ilike.${term},lead_intent.ilike.${term},lead_city.ilike.${term},last_message_content.ilike.${term}`,
    );
  }

  const { data, error } = await q.order('last_message_at', {
    ascending: false,
    nullsFirst: false,
  });
  if (error) throw error;
  return (data ?? []) as ConversationSummary[];
}

export async function fetchNewHotLeads(
  supabase: SupabaseClient,
  newSince: string,
  limit = 10,
): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from('conversation_summary')
    .select('*')
    .gte('lead_score', 70)
    .gt('created_at', newSince)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ConversationSummary[];
}

export async function fetchDashboardStats(
  supabase: SupabaseClient,
  botId?: string,
): Promise<DashboardStats> {
  const todayBounds = mexicoDayBounds(formatMexicoDate(new Date()));
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  let todayQuery = supabase
    .from('conversation_summary')
    .select('id, lead_captured, lead_temperature, needs_reply, last_message_at')
    .gte('last_message_at', todayBounds.start)
    .lte('last_message_at', todayBounds.end);

  if (botId) todayQuery = todayQuery.eq('bot_id', botId);

  const { data: todayRows, error: todayError } = await todayQuery;
  if (todayError) throw todayError;

  const rows = todayRows ?? [];
  const conversationsToday = rows.length;
  const hotLeadsToday = rows.filter((r) => r.lead_temperature === 'hot').length;
  const activeLastHour = rows.filter(
    (r) => r.last_message_at && r.last_message_at >= oneHourAgo,
  ).length;
  const unanswered = rows.filter((r) => r.needs_reply).length;

  let newTodayQuery = supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', todayBounds.start)
    .lte('created_at', todayBounds.end);

  if (botId) newTodayQuery = newTodayQuery.eq('bot_id', botId);

  const { count: newToday, error: newError } = await newTodayQuery;
  if (newError) throw newError;

  const leadsToday = rows.filter((r) => r.lead_captured).length;
  const conversionRate =
    (newToday ?? 0) > 0
      ? Math.round((leadsToday / (newToday ?? 1)) * 10000) / 100
      : 0;

  return {
    conversationsToday,
    hotLeadsToday,
    activeLastHour,
    unanswered,
    conversionRate,
  };
}

export async function fetchConversationDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<ConversationDetail | null> {
  const [summaryResult, messagesResult] = await Promise.all([
    supabase.from('conversation_summary').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('messages')
      .select('id, role, content, created_at, source, source_type, metadata')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (summaryResult.error) throw summaryResult.error;
  if (messagesResult.error) throw messagesResult.error;
  if (!summaryResult.data) return null;

  return {
    ...(summaryResult.data as ConversationSummary),
    messages: (messagesResult.data ?? []) as ConversationMessage[],
  };
}

export async function fetchBots(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('bots').select('id, name').order('name');
  if (error) throw error;
  return data ?? [];
}
