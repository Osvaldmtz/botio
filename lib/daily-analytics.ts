import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

const ANALYSIS_MODEL = 'claude-sonnet-4-6';
const MAX_CONVERSATIONS_FOR_AI = 100;
const MEXICO_TZ = 'America/Mexico_City';

export type DailyReport = {
  bot_id: string;
  report_date: string;
  total_conversations: number;
  new_conversations: number;
  leads_captured: number;
  hot_leads: number;
  trials_activated: number;
  conversion_rate: number;
  top_questions: string[];
  top_objections: string[];
  dropped_conversations: Array<Record<string, unknown>>;
  actionable_insights: string[];
  featured_lead: Record<string, unknown> | null;
  comparison_yesterday: Record<string, unknown> | null;
  comparison_last_week: Record<string, unknown> | null;
  raw_ai_response: string;
  executive_summary: string;
};

type ConversationRow = {
  id: string;
  customer_phone: string;
  created_at: string;
  lead_captured: boolean;
  lead_score: number | null;
  lead_temperature: string | null;
  lead_intent: string | null;
  lead_signals: string[] | null;
  lead_country: string | null;
  lead_city: string | null;
};

type MessageRow = {
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
  source: string | null;
  metadata: Record<string, unknown> | null;
};

type ConversationSnapshot = {
  id: string;
  phone: string;
  score: number | null;
  temperature: string | null;
  intent: string | null;
  signals: string[];
  lead_captured: boolean;
  total_messages: number;
  user_messages: number;
  first_user_message: string;
  last_user_message: string;
  created_today: boolean;
};

type AiAnalysisPayload = {
  top_questions: string[];
  top_objections: string[];
  dropped_conversations: Array<Record<string, unknown>>;
  actionable_insights: string[];
  featured_lead: Record<string, unknown> | null;
  comparison_yesterday: Record<string, unknown>;
  comparison_last_week: Record<string, unknown>;
  executive_summary: string;
};

const ANALYSIS_SYSTEM_PROMPT = `Eres el analista de conversaciones de Botio para el bot Kalyo (WhatsApp para psicólogos).
Analiza las conversaciones del día y responde ÚNICAMENTE con JSON válido (sin markdown, sin texto extra).

Estructura exacta:
{
  "top_questions": ["pregunta o tema más repetido", ...],           // máx 5
  "top_objections": ["objeción o fricción detectada", ...],        // máx 5
  "dropped_conversations": [
    { "phone": "+52...", "reason": "por qué abandonó", "last_user_message": "..." }
  ],                                                               // máx 5, fantasmas o sin respuesta
  "actionable_insights": ["insight accionable para el equipo", ...], // máx 5
  "featured_lead": {
    "phone": "+52...",
    "score": 85,
    "why": "por qué es el lead destacado",
    "summary": "resumen en 2 oraciones"
  } | null,
  "comparison_yesterday": {
    "summary": "1-2 oraciones vs ayer",
    "highlights": ["cambio notable", ...]
  },
  "comparison_last_week": {
    "summary": "1-2 oraciones vs mismo día semana pasada",
    "highlights": ["cambio notable", ...]
  },
  "executive_summary": "Resumen ejecutivo de 3-5 oraciones para el admin. Incluye volumen, calidad de leads, y la acción #1 para mañana."
}

Reglas:
- Escribe en español (México).
- Sé específico con datos del payload (teléfonos, scores, intents).
- featured_lead: el mejor lead del día (hot/warm con mayor score), o null si no hay.
- dropped_conversations: usuarios que dejaron de responder tras 1-2 intercambios.
- Usa comparison_context del payload para comparaciones; si no hay datos previos, indícalo.`;

export function formatMexicoDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: MEXICO_TZ }).format(date);
}

export function getMexicoCityDayBounds(reportDate: string): { startIso: string; endIso: string } {
  let startMs: number | null = null;
  let endMs: number | null = null;
  const probeStart = Date.parse(`${reportDate}T05:00:00.000Z`) - 14 * 3600 * 1000;

  for (let ms = probeStart; ms < probeStart + 52 * 3600 * 1000; ms += 60_000) {
    const d = new Date(ms);
    if (formatMexicoDate(d) !== reportDate) continue;
    if (startMs === null) startMs = ms;
    endMs = ms + 60_000 - 1;
  }

  if (startMs === null || endMs === null) {
    throw new Error(`Could not resolve Mexico City day bounds for ${reportDate}`);
  }

  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
  };
}

function shiftMexicoDate(reportDate: string, days: number): string {
  const { startIso } = getMexicoCityDayBounds(reportDate);
  const shifted = new Date(Date.parse(startIso) + days * 24 * 60 * 60 * 1000);
  return formatMexicoDate(shifted);
}

function parseSignals(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

function countTrialsActivated(messages: MessageRow[]): number {
  const trialRe = /prueba\s+pro.*activa|trial.*activo|activamos?\s+tu\s+pro/i;
  return messages.filter((m) => {
    if (m.metadata?.trial_activated === true) return true;
    return m.role === 'assistant' && trialRe.test(m.content);
  }).length;
}

function buildSnapshot(
  conv: ConversationRow,
  messages: MessageRow[],
  createdToday: boolean,
): ConversationSnapshot {
  const userMsgs = messages.filter((m) => m.role === 'user');
  const first = userMsgs[0]?.content ?? '';
  const last = userMsgs[userMsgs.length - 1]?.content ?? '';

  return {
    id: conv.id,
    phone: conv.customer_phone,
    score: conv.lead_score,
    temperature: conv.lead_temperature,
    intent: conv.lead_intent,
    signals: parseSignals(conv.lead_signals),
    lead_captured: conv.lead_captured,
    total_messages: messages.length,
    user_messages: userMsgs.length,
    first_user_message: first.slice(0, 200),
    last_user_message: last.slice(0, 200),
    created_today: createdToday,
  };
}

async function loadPriorReportSummary(
  supabase: SupabaseClient,
  botId: string,
  reportDate: string,
): Promise<{ yesterday: Record<string, unknown> | null; lastWeek: Record<string, unknown> | null }> {
  const yesterdayDate = shiftMexicoDate(reportDate, -1);
  const lastWeekDate = shiftMexicoDate(reportDate, -7);

  const { data } = await supabase
    .from('daily_reports')
    .select(
      'report_date, total_conversations, new_conversations, leads_captured, hot_leads, trials_activated, conversion_rate',
    )
    .eq('bot_id', botId)
    .in('report_date', [yesterdayDate, lastWeekDate]);

  const rows = data ?? [];
  const yesterday = rows.find((r) => r.report_date === yesterdayDate) ?? null;
  const lastWeek = rows.find((r) => r.report_date === lastWeekDate) ?? null;

  return {
    yesterday: yesterday
      ? {
          report_date: yesterdayDate,
          total_conversations: yesterday.total_conversations,
          new_conversations: yesterday.new_conversations,
          leads_captured: yesterday.leads_captured,
          hot_leads: yesterday.hot_leads,
          trials_activated: yesterday.trials_activated,
          conversion_rate: yesterday.conversion_rate,
        }
      : null,
    lastWeek: lastWeek
      ? {
          report_date: lastWeekDate,
          total_conversations: lastWeek.total_conversations,
          new_conversations: lastWeek.new_conversations,
          leads_captured: lastWeek.leads_captured,
          hot_leads: lastWeek.hot_leads,
          trials_activated: lastWeek.trials_activated,
          conversion_rate: lastWeek.conversion_rate,
        }
      : null,
  };
}

async function analyzeWithSonnet(
  reportDate: string,
  metrics: Record<string, unknown>,
  conversations: ConversationSnapshot[],
  comparisonContext: Record<string, unknown>,
): Promise<{ parsed: AiAnalysisPayload; raw: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');

  const anthropic = new Anthropic({ apiKey });
  const userPayload = {
    report_date: reportDate,
    metrics,
    comparison_context: comparisonContext,
    conversations,
  };

  const response = await anthropic.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 4096,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: JSON.stringify(userPayload),
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  const raw = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Claude analysis did not return JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]) as AiAnalysisPayload;
  return { parsed, raw };
}

export async function generateDailyReport(
  supabase: SupabaseClient,
  botId: string,
  targetDate: string,
): Promise<DailyReport> {
  const { startIso, endIso } = getMexicoCityDayBounds(targetDate);
  console.log('[daily-analytics] generating', { botId, targetDate, startIso, endIso });

  const { data: dayMessages, error: msgError } = await supabase
    .from('messages')
    .select(
      'conversation_id, role, content, created_at, source, metadata, conversations!inner(bot_id)',
    )
    .eq('conversations.bot_id', botId)
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  if (msgError) throw msgError;

  const activeConvIds = Array.from(
    new Set((dayMessages ?? []).map((m) => m.conversation_id)),
  );
  if (activeConvIds.length === 0) {
    const empty: DailyReport = {
      bot_id: botId,
      report_date: targetDate,
      total_conversations: 0,
      new_conversations: 0,
      leads_captured: 0,
      hot_leads: 0,
      trials_activated: 0,
      conversion_rate: 0,
      top_questions: [],
      top_objections: [],
      dropped_conversations: [],
      actionable_insights: ['Sin conversaciones activas este día.'],
      featured_lead: null,
      comparison_yesterday: null,
      comparison_last_week: null,
      raw_ai_response: '',
      executive_summary: `Sin actividad el ${targetDate}.`,
    };
    return empty;
  }

  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select(
      'id, customer_phone, created_at, lead_captured, lead_score, lead_temperature, lead_intent, lead_signals, lead_country, lead_city',
    )
    .eq('bot_id', botId)
    .in('id', activeConvIds);

  if (convError) throw convError;

  const { data: allMessages, error: allMsgError } = await supabase
    .from('messages')
    .select('conversation_id, role, content, created_at, source, metadata')
    .in('conversation_id', activeConvIds)
    .order('created_at', { ascending: true });

  if (allMsgError) throw allMsgError;

  const convRows = (conversations ?? []) as ConversationRow[];
  const messagesByConv = new Map<string, MessageRow[]>();
  for (const m of (allMessages ?? []) as MessageRow[]) {
    const list = messagesByConv.get(m.conversation_id) ?? [];
    list.push(m);
    messagesByConv.set(m.conversation_id, list);
  }

  const snapshots = convRows.map((conv) => {
    const msgs = messagesByConv.get(conv.id) ?? [];
    const createdToday =
      conv.created_at >= startIso && conv.created_at <= endIso;
    return buildSnapshot(conv, msgs, createdToday);
  });

  const newConversations = snapshots.filter((s) => s.created_today).length;
  const leadsCaptured = snapshots.filter((s) => s.lead_captured).length;
  const hotLeads = snapshots.filter((s) => s.temperature === 'hot').length;
  const trialsActivated = countTrialsActivated((dayMessages ?? []) as MessageRow[]);
  const conversionRate =
    newConversations > 0
      ? Math.round((leadsCaptured / newConversations) * 10000) / 100
      : 0;

  const sortedForAi = [...snapshots]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_CONVERSATIONS_FOR_AI);

  const prior = await loadPriorReportSummary(supabase, botId, targetDate);

  const metrics = {
    total_conversations: snapshots.length,
    new_conversations: newConversations,
    leads_captured: leadsCaptured,
    hot_leads: hotLeads,
    trials_activated: trialsActivated,
    conversion_rate: conversionRate,
  };

  let aiParsed: AiAnalysisPayload;
  let rawAi = '';

  try {
    const ai = await analyzeWithSonnet(targetDate, metrics, sortedForAi, {
      yesterday: prior.yesterday,
      last_week: prior.lastWeek,
    });
    aiParsed = ai.parsed;
    rawAi = ai.raw;
  } catch (error) {
    console.error('[daily-analytics] Claude analysis failed', error);
    aiParsed = {
      top_questions: [],
      top_objections: [],
      dropped_conversations: [],
      actionable_insights: ['El análisis IA falló — revisar logs.'],
      featured_lead: null,
      comparison_yesterday: {
        summary: prior.yesterday ? 'Datos de ayer disponibles en DB.' : 'Sin reporte de ayer.',
        highlights: [],
      },
      comparison_last_week: {
        summary: prior.lastWeek ? 'Datos de la semana pasada disponibles en DB.' : 'Sin reporte de la semana pasada.',
        highlights: [],
      },
      executive_summary: `Reporte del ${targetDate}: ${snapshots.length} conversaciones, ${leadsCaptured} leads, ${hotLeads} hot.`,
    };
  }

  return {
    bot_id: botId,
    report_date: targetDate,
    total_conversations: snapshots.length,
    new_conversations: newConversations,
    leads_captured: leadsCaptured,
    hot_leads: hotLeads,
    trials_activated: trialsActivated,
    conversion_rate: conversionRate,
    top_questions: aiParsed.top_questions ?? [],
    top_objections: aiParsed.top_objections ?? [],
    dropped_conversations: aiParsed.dropped_conversations ?? [],
    actionable_insights: aiParsed.actionable_insights ?? [],
    featured_lead: aiParsed.featured_lead ?? null,
    comparison_yesterday: aiParsed.comparison_yesterday ?? null,
    comparison_last_week: aiParsed.comparison_last_week ?? null,
    raw_ai_response: rawAi,
    executive_summary: aiParsed.executive_summary ?? '',
  };
}

export async function persistDailyReport(
  supabase: SupabaseClient,
  report: DailyReport,
  telegramSent: boolean,
): Promise<void> {
  const { error } = await supabase.from('daily_reports').upsert(
    {
      bot_id: report.bot_id,
      report_date: report.report_date,
      total_conversations: report.total_conversations,
      new_conversations: report.new_conversations,
      leads_captured: report.leads_captured,
      hot_leads: report.hot_leads,
      trials_activated: report.trials_activated,
      conversion_rate: report.conversion_rate,
      top_questions: report.top_questions,
      top_objections: report.top_objections,
      dropped_conversations: report.dropped_conversations,
      actionable_insights: report.actionable_insights,
      featured_lead: report.featured_lead,
      comparison_yesterday: report.comparison_yesterday,
      comparison_last_week: report.comparison_last_week,
      raw_ai_response: report.raw_ai_response,
      telegram_sent: telegramSent,
    },
    { onConflict: 'bot_id,report_date' },
  );

  if (error) {
    console.error('[daily-analytics] failed to persist report', error);
    throw error;
  }
}
