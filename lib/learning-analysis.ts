import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SALES_CONVERSATIONS_OR, TEAM_MEMBERS_FILTER } from '@/lib/ambassador-filters';

export const ANALYSIS_MODEL = 'claude-sonnet-4-6';
export const MIN_CONVERSATIONS_FOR_ANALYSIS = 10;
export const ANALYSIS_WINDOW_DAYS = 7;
const MAX_CONVERSATIONS_FOR_AI = 35;
const MAX_MESSAGES_PER_CONV = 40;
const MAX_MESSAGE_CHARS = 600;

export type ConversationMessage = { role: string; content: string };

export type AnalysisConversation = {
  id: string;
  outcome: string;
  outcome_date: string;
  lead_score: number | null;
  lead_temperature: string | null;
  pipeline_stage: string | null;
  ab_variant: string | null;
  metadata: Record<string, unknown> | null;
  messages: ConversationMessage[];
  hours_to_outcome: number | null;
};

export type ActionableInsight = {
  priority: 'high' | 'medium' | 'low';
  insight: string;
  suggested_change: string;
};

export type LearningInsightsPayload = {
  summary: string;
  won_patterns: string[];
  lost_patterns: string[];
  objection_analysis: Record<string, unknown>;
  variant_comparison: Record<string, unknown>;
  actionable_insights: ActionableInsight[];
};

export type AnalysisGroups = {
  won: AnalysisConversation[];
  lost: AnalysisConversation[];
  unsub: AnalysisConversation[];
};

export type LearningAnalysisResult =
  | { status: 'skipped'; reason: string; count: number }
  | {
      status: 'ok';
      insight_id: string;
      total: number;
      won: number;
      lost: number;
      unsub: number;
      conversion_rate: number;
    };

const ANALYSIS_SYSTEM_PROMPT = `Eres analista de conversaciones de Botio (Sofía, asistente de ventas WhatsApp para Kalyo, SaaS de psicólogos).
Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto extra).

Estructura exacta:
{
  "summary": "string corto",
  "won_patterns": ["..."],
  "lost_patterns": ["..."],
  "objection_analysis": { "common_objections": ["..."], "effective_responses": ["..."] },
  "variant_comparison": { "notes": "...", "variants": {} },
  "actionable_insights": [
    { "priority": "high|medium|low", "insight": "...", "suggested_change": "..." }
  ]
}

Reglas:
- Escribe en español (México).
- actionable_insights: exactamente 3 items, ordenados por impacto.
- Sé específico con patrones reales del payload, no genéricos.`;

function truncateContent(text: string): string {
  if (text.length <= MAX_MESSAGE_CHARS) return text;
  return `${text.slice(0, MAX_MESSAGE_CHARS)}…`;
}

function readAbVariant(metadata: Record<string, unknown> | null): string | null {
  const variant = metadata?.ab_variant;
  return typeof variant === 'string' ? variant : null;
}

function hoursBetween(startIso: string, endIso: string): number | null {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round(((end - start) / 3600000) * 10) / 10;
}

export function groupConversationsByOutcome(
  conversations: AnalysisConversation[],
): AnalysisGroups {
  const won: AnalysisConversation[] = [];
  const lost: AnalysisConversation[] = [];
  const unsub: AnalysisConversation[] = [];

  for (const conv of conversations) {
    if (conv.outcome === 'paid' || conv.outcome === 'trial_activated') {
      won.push(conv);
    } else if (conv.outcome === 'unsubscribed') {
      unsub.push(conv);
    } else if (conv.outcome.startsWith('lost_')) {
      lost.push(conv);
    }
  }

  return { won, lost, unsub };
}

export async function fetchConversationsForAnalysis(
  supabase: SupabaseClient,
  periodStart: string,
  periodEnd?: string,
): Promise<AnalysisConversation[]> {
  let query = supabase
    .from('conversations')
    .select(
      'id, outcome, outcome_date, created_at, lead_score, lead_temperature, pipeline_stage, metadata',
    )
    .not('outcome', 'is', null)
    .gte('outcome_date', periodStart)
    .or(TEAM_MEMBERS_FILTER)
    .or(SALES_CONVERSATIONS_OR)
    .order('outcome_date', { ascending: false });

  if (periodEnd) {
    query = query.lte('outcome_date', periodEnd);
  }

  const { data: convRows, error: convError } = await query;
  if (convError) throw convError;

  const rows = (convRows ?? []).slice(0, MAX_CONVERSATIONS_FOR_AI);
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id as string);
  const { data: messageRows, error: msgError } = await supabase
    .from('messages')
    .select('conversation_id, role, content, created_at')
    .in('conversation_id', ids)
    .order('created_at', { ascending: true });

  if (msgError) throw msgError;

  const messagesByConv = new Map<string, ConversationMessage[]>();
  for (const msg of messageRows ?? []) {
    const convId = msg.conversation_id as string;
    const list = messagesByConv.get(convId) ?? [];
    if (list.length >= MAX_MESSAGES_PER_CONV) continue;
    list.push({
      role: msg.role as string,
      content: truncateContent((msg.content as string) ?? ''),
    });
    messagesByConv.set(convId, list);
  }

  return rows.map((row) => {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? null;
    const outcomeDate = row.outcome_date as string;
    const createdAt = row.created_at as string;
    return {
      id: row.id as string,
      outcome: row.outcome as string,
      outcome_date: outcomeDate,
      lead_score: (row.lead_score as number | null) ?? null,
      lead_temperature: (row.lead_temperature as string | null) ?? null,
      pipeline_stage: (row.pipeline_stage as string | null) ?? null,
      ab_variant: readAbVariant(metadata),
      metadata,
      messages: messagesByConv.get(row.id as string) ?? [],
      hours_to_outcome: hoursBetween(createdAt, outcomeDate),
    };
  });
}

export function buildAnalysisPrompt(groups: AnalysisGroups): string {
  return `Analiza estas conversaciones de Botio (asistente de ventas Sofía para Kalyo, SaaS de psicólogos).

GANADAS (convirtieron):
${JSON.stringify(groups.won, null, 2)}

PERDIDAS (no convirtieron):
${JSON.stringify(groups.lost, null, 2)}

BAJAS (pidieron no contacto):
${JSON.stringify(groups.unsub, null, 2)}

Identifica:
1. Patrones de las GANADAS — qué hizo Sofía bien
2. Patrones de las PERDIDAS — qué falló
3. Objeciones más comunes y respuestas que funcionaron
4. Comparación entre ab_variant (si hay diferencias significativas)
5. Top 3 INSIGHTS ACCIONABLES (qué cambiar en el prompt de Sofía)`;
}

export function parseInsightsJson(raw: string): LearningInsightsPayload {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Claude analysis did not return JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]) as LearningInsightsPayload;
  if (!parsed.summary || !Array.isArray(parsed.actionable_insights)) {
    throw new Error('Claude JSON missing required fields');
  }

  return parsed;
}

export async function analyzeConversationsWithClaude(
  groups: AnalysisGroups,
  options?: { apiKey?: string },
): Promise<LearningInsightsPayload> {
  const apiKey = options?.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 4096,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildAnalysisPrompt(groups) }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  const raw = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';
  return parseInsightsJson(raw);
}

export function computeConversionRate(won: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((won / total) * 1000) / 10;
}

export function getAnalysisWindow(): { periodStart: string; periodEnd: string } {
  const periodEnd = new Date();
  const periodStart = new Date(
    periodEnd.getTime() - ANALYSIS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}

export async function saveLearningInsight(
  supabase: SupabaseClient,
  params: {
    periodStart: string;
    periodEnd: string;
    total: number;
    paidCount: number;
    trialCount: number;
    lostCount: number;
    insights: LearningInsightsPayload;
  },
): Promise<string> {
  const { data, error } = await supabase
    .from('learning_insights')
    .insert({
      period_start: params.periodStart,
      period_end: params.periodEnd,
      total_conversations: params.total,
      paid_count: params.paidCount,
      trial_count: params.trialCount,
      lost_count: params.lostCount,
      insights: params.insights,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to insert learning_insights');
  }

  return data.id as string;
}

export type RunLearningAnalysisOptions = {
  periodStart?: string;
  periodEnd?: string;
  minConversations?: number;
  skipTelegram?: boolean;
  analyzeFn?: (groups: AnalysisGroups) => Promise<LearningInsightsPayload>;
  sendTelegramFn?: (text: string) => Promise<{ sent: boolean; error?: string }>;
};

export type LearningTelegramParams = {
  periodStart: string;
  periodEnd: string;
  total: number;
  wonCount: number;
  lostCount: number;
  conversionRate: number;
  insights: LearningInsightsPayload;
};

function formatPeriodLabel(startIso: string, endIso: string): string {
  const opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeZone: 'UTC' };
  const start = new Date(startIso).toLocaleDateString('es-MX', opts);
  const end = new Date(endIso).toLocaleDateString('es-MX', opts);
  return `${start} al ${end}`;
}

function priorityEmoji(priority: string): string {
  if (priority === 'high') return '🔴';
  if (priority === 'medium') return '🟡';
  return '🟢';
}

export function formatLearningInsightTelegram(params: LearningTelegramParams): string {
  const period = formatPeriodLabel(params.periodStart, params.periodEnd);
  const top3 = params.insights.actionable_insights.slice(0, 3);

  const lines = [
    `📊 Análisis semanal ML — Semana del ${period}`,
    '',
    `Conversaciones: ${params.total} (WON: ${params.wonCount}, LOST: ${params.lostCount})`,
    `Tasa conversión: ${params.conversionRate}%`,
    '',
    'Top 3 insights:',
  ];

  top3.forEach((item, i) => {
    lines.push(`${i + 1}. ${priorityEmoji(item.priority)} ${item.insight}`);
  });

  lines.push('', 'Ver completo: botio.dgx.agency/admin/learning');

  return lines.join('\n');
}

export async function runLearningAnalysis(
  supabase: SupabaseClient,
  options?: RunLearningAnalysisOptions,
): Promise<LearningAnalysisResult> {
  const window = getAnalysisWindow();
  const periodStart = options?.periodStart ?? window.periodStart;
  const periodEnd = options?.periodEnd ?? window.periodEnd;
  const minConversations = options?.minConversations ?? MIN_CONVERSATIONS_FOR_ANALYSIS;

  console.log('[learning-analysis] starting', { periodStart, periodEnd });

  const conversations = await fetchConversationsForAnalysis(
    supabase,
    periodStart,
    periodEnd,
  );

  if (conversations.length < minConversations) {
    console.log(
      `[learning-analysis] skip | count=${conversations.length} | min=${minConversations}`,
    );
    return {
      status: 'skipped',
      reason: 'insufficient_data',
      count: conversations.length,
    };
  }

  const groups = groupConversationsByOutcome(conversations);
  const wonCount = groups.won.length;
  const lostCount = groups.lost.length + groups.unsub.length;
  const paidCount = groups.won.filter((c) => c.outcome === 'paid').length;
  const trialCount = groups.won.filter((c) => c.outcome === 'trial_activated').length;
  const total = conversations.length;
  const conversionRate = computeConversionRate(wonCount, total);

  const analyzeFn = options?.analyzeFn ?? analyzeConversationsWithClaude;
  const insights = await analyzeFn(groups);

  const insightId = await saveLearningInsight(supabase, {
    periodStart,
    periodEnd,
    total,
    paidCount,
    trialCount,
    lostCount,
    insights,
  });

  if (!options?.skipTelegram) {
    const text = formatLearningInsightTelegram({
      periodStart,
      periodEnd,
      total,
      wonCount,
      lostCount,
      conversionRate,
      insights,
    });
    if (options?.sendTelegramFn) {
      await options.sendTelegramFn(text);
    } else {
      const { sendLearningInsightTelegram } = await import('@/lib/learning-insight-telegram');
      await sendLearningInsightTelegram(text);
    }
  }

  console.log(`[learning-analysis] done | insight_id=${insightId} | total=${total}`);

  return {
    status: 'ok',
    insight_id: insightId,
    total,
    won: wonCount,
    lost: lostCount,
    unsub: groups.unsub.length,
    conversion_rate: conversionRate,
  };
}
