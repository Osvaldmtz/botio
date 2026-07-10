import type { SupabaseClient } from '@supabase/supabase-js';
import type { EnrichedLead, ConversationMessage } from '@/lib/lead-enrichment';
import { customerDisplayName } from '@/app/admin/conversations/lib/format';

export const HOT_LEAD_SCORE_THRESHOLD = 70;
export const STALE_HOT_ALERT_MS = 2 * 60 * 60 * 1000;
const HOT_ALERT_PREFIX = 'hot_alert:';
const RE_ALERT_MS = 24 * 60 * 60 * 1000;
const ADMIN_BASE_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://botio.dgx.agency';

type ConversationRow = {
  id: string;
  customer_phone: string;
  channel?: string | null;
  session_id?: string | null;
  lead_score?: number | null;
  lead_temperature?: string | null;
  lead_intent?: string | null;
  lead_city?: string | null;
  lead_country?: string | null;
  lead_signals?: string[] | null;
  enriched_at?: string | null;
  hot_alert_sent_at?: string | null;
};

export function normalizeLeadSignals(signals: unknown): string[] {
  if (Array.isArray(signals)) {
    return signals.filter((s): s is string => typeof s === 'string');
  }
  return [];
}

export function mergeLeadSignalsPreservingHotAlerts(
  enrichedSignals: string[],
  existingSignals: unknown,
): string[] {
  const hotAlertSignals = normalizeLeadSignals(existingSignals).filter((s) =>
    s.startsWith(HOT_ALERT_PREFIX),
  );
  return [...enrichedSignals, ...hotAlertSignals];
}

export function parseHotAlertAt(signals: string[] | null | undefined): Date | null {
  const normalized = normalizeLeadSignals(signals);
  if (!normalized.length) return null;
  for (const signal of normalized) {
    if (signal.startsWith(HOT_ALERT_PREFIX)) {
      const iso = signal.slice(HOT_ALERT_PREFIX.length);
      const date = new Date(iso);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  return null;
}

export function resolveHotAlertSentAt(
  hotAlertSentAt: string | null | undefined,
  signals: string[] | null | undefined,
): Date | null {
  if (hotAlertSentAt) {
    const fromColumn = new Date(hotAlertSentAt);
    if (!Number.isNaN(fromColumn.getTime())) return fromColumn;
  }
  return parseHotAlertAt(signals);
}

export function shouldSendHotAlert(
  signals: string[] | null | undefined,
  hotAlertSentAt?: string | null,
): boolean {
  const lastSent = resolveHotAlertSentAt(hotAlertSentAt, signals);
  if (!lastSent) return true;
  return Date.now() - lastSent.getTime() >= RE_ALERT_MS;
}

export function isStaleHotLead(
  lastMessageAt: string | null | undefined,
  enrichedAt?: string | null,
): boolean {
  const reference = lastMessageAt ?? enrichedAt;
  if (!reference) return false;
  const timestamp = new Date(reference).getTime();
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp > STALE_HOT_ALERT_MS;
}

function stripHotAlertSignals(signals: string[]): string[] {
  return signals.filter((s) => !s.startsWith(HOT_ALERT_PREFIX));
}

function displayContact(conv: ConversationRow): string {
  if (conv.channel === 'webchat' && conv.session_id) return `Webchat ${conv.session_id}`;
  if (conv.channel === 'telegram') return conv.customer_phone.replace(/^tg:/, 'Telegram ');
  return conv.customer_phone;
}

function lastUserMessage(messages: ConversationMessage[], maxLen = 200): string {
  const users = messages.filter((m) => m.role === 'user');
  const last = users[users.length - 1];
  if (!last) return '—';
  const text = last.content.trim();
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

function formatDetectedAt(timezone = 'America/Mexico_City'): string {
  return new Date().toLocaleString('es-MX', {
    timeZone: timezone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function buildHotLeadTelegramMessage(params: {
  conversation: ConversationRow;
  enrichment: EnrichedLead;
  name?: string;
  email?: string;
  messages?: ConversationMessage[];
}): string {
  const { conversation, enrichment } = params;
  const name = params.name?.trim() || customerDisplayName(conversation.customer_phone, conversation.lead_signals ?? null);
  const contact = displayContact(conversation);
  const email = params.email?.trim() || '—';
  const city = enrichment.city ?? conversation.lead_city ?? 'No declarada';
  const signals = enrichment.signals.length
    ? enrichment.signals.join(', ')
    : 'Sin señales adicionales';
  const detectedAt = formatDetectedAt(enrichment.timezone);
  const convUrl = `${ADMIN_BASE_URL}/admin/conversations/${conversation.id}`;

  return [
    '🔥 <b>HOT LEAD detectado</b>',
    '',
    `👤 ${name}`,
    `📱 ${contact}`,
    `📧 ${email}`,
    `📍 ${city}`,
    '',
    `📊 Score: ${enrichment.score}/100`,
    `🌡️ Temperatura: ${enrichment.temperature}`,
    `🎯 Intent: ${enrichment.intent}`,
    '',
    `🚨 Señales: ${signals}`,
    '',
    `⏱️ Detectado: ${detectedAt} CDMX`,
    `🔗 <a href="${convUrl}">Ver conversación</a>`,
    '',
    'Recomendación: contactar en próximos 30 minutos para maximizar conversión.',
    params.messages?.length ? `\n💬 Último mensaje: "<i>${lastUserMessage(params.messages)}</i>"` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function loadHotAlertState(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ signals: string[]; hotAlertSentAt: string | null }> {
  const { data, error } = await supabase
    .from('conversations')
    .select('lead_signals, hot_alert_sent_at')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) throw error;

  return {
    signals: normalizeLeadSignals(data?.lead_signals),
    hotAlertSentAt: (data?.hot_alert_sent_at as string | null | undefined) ?? null,
  };
}

export async function sendHotLeadAlert(params: {
  supabase: SupabaseClient;
  conversation: ConversationRow;
  enrichment: EnrichedLead;
  messages?: ConversationMessage[];
  name?: string;
  email?: string;
  force?: boolean;
}): Promise<{ sent: boolean; reason?: string }> {
  const { supabase, conversation, enrichment } = params;

  if (enrichment.score < HOT_LEAD_SCORE_THRESHOLD) {
    return { sent: false, reason: 'score_below_threshold' };
  }

  const { signals, hotAlertSentAt } = await loadHotAlertState(supabase, conversation.id);

  if (!params.force && !shouldSendHotAlert(signals, hotAlertSentAt)) {
    console.log(`[hot-lead-alert] skipped — already sent for conv=${conversation.id}`);
    return { sent: false, reason: 'already_sent' };
  }

  if (!params.force) {
    const { data: freshness } = await supabase
      .from('conversations')
      .select('last_message_at, enriched_at')
      .eq('id', conversation.id)
      .maybeSingle();

    if (
      isStaleHotLead(
        freshness?.last_message_at as string | null | undefined,
        freshness?.enriched_at as string | null | undefined,
      )
    ) {
      console.log(`[hot-lead-alert] skipped — stale lead for conv=${conversation.id}`);
      return { sent: false, reason: 'stale_lead' };
    }
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[hot-lead-alert] missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID');
    return { sent: false, reason: 'missing_telegram_env' };
  }

  const text = buildHotLeadTelegramMessage(params);

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[hot-lead-alert] send failed', response.status, body);
      return { sent: false, reason: `telegram_${response.status}` };
    }

    const sentAt = new Date().toISOString();
    const userSignals = stripHotAlertSignals(signals);
    const updatedSignals = [...userSignals, `${HOT_ALERT_PREFIX}${sentAt}`];

    const { error: persistError } = await supabase
      .from('conversations')
      .update({
        lead_signals: updatedSignals,
        hot_alert_sent_at: sentAt,
      })
      .eq('id', conversation.id);

    if (persistError) {
      console.error(
        `[hot-lead-alert] failed to persist hot_alert signal | conv=${conversation.id}`,
        persistError,
      );
      return { sent: false, reason: 'persist_failed' };
    }

    console.log(
      `[telegram-notify] hot lead alert sent | conv=${conversation.id} score=${enrichment.score}`,
    );
    return { sent: true };
  } catch (error) {
    console.error('[hot-lead-alert] error', error);
    return { sent: false, reason: 'exception' };
  }
}

export async function notifyHotLeadIfNew(params: {
  supabase: SupabaseClient;
  conversation: ConversationRow;
  enrichment: EnrichedLead;
  previousScore: number;
  messages?: ConversationMessage[];
  name?: string;
  email?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const { enrichment, previousScore } = params;
  const newScore = enrichment.score;
  const crossedThreshold =
    newScore >= HOT_LEAD_SCORE_THRESHOLD && previousScore < HOT_LEAD_SCORE_THRESHOLD;

  if (newScore < HOT_LEAD_SCORE_THRESHOLD) {
    return { sent: false, reason: 'not_hot' };
  }

  const neverAlerted = !resolveHotAlertSentAt(
    params.conversation.hot_alert_sent_at,
    params.conversation.lead_signals,
  );
  if (!crossedThreshold && !neverAlerted) {
    return { sent: false, reason: 'already_hot_no_new_crossing' };
  }

  return sendHotLeadAlert(params);
}

export async function notifyHotLeadFromConversation(
  supabase: SupabaseClient,
  conversationId: string,
  options?: { force?: boolean; email?: string; name?: string },
): Promise<{ sent: boolean; reason?: string }> {
  const { data: conv, error } = await supabase
    .from('conversations')
    .select(
      'id, customer_phone, channel, session_id, lead_score, lead_temperature, lead_intent, lead_city, lead_country, lead_signals, enriched_at, hot_alert_sent_at',
    )
    .eq('id', conversationId)
    .maybeSingle();

  if (error) throw error;
  if (!conv) return { sent: false, reason: 'not_found' };

  const score = conv.lead_score ?? 0;
  if (score < HOT_LEAD_SCORE_THRESHOLD) {
    return { sent: false, reason: 'score_below_threshold' };
  }

  const enrichment: EnrichedLead = {
    score,
    temperature: (conv.lead_temperature as EnrichedLead['temperature']) ?? 'hot',
    country: conv.lead_country ?? '—',
    city: conv.lead_city ?? undefined,
    timezone: 'America/Mexico_City',
    signals: stripHotAlertSignals((conv.lead_signals as string[]) ?? []),
    intent: conv.lead_intent ?? '—',
    recommendedAction: '🔥 Contactar en próximos 30 minutos',
  };

  const { data: messages } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  return sendHotLeadAlert({
    supabase,
    conversation: conv as ConversationRow,
    enrichment,
    messages: (messages ?? []) as ConversationMessage[],
    name: options?.name,
    email: options?.email,
    force: options?.force,
  });
}
