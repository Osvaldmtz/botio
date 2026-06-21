import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export const AD_PREFILL_RE =
  /me\s+interesa\s+conocer\s+kalyo|quiero\s+conocer\s+kalyo|interesa\s+kalyo|info(?:rmaci[oó]n)?\s+sobre\s+kalyo/i;

export function isAdPrefillMessage(text: string): boolean {
  return AD_PREFILL_RE.test(text);
}

export function isKalyoBotId(botId: string): boolean {
  const kalyoBotId = process.env.KALYO_BOT_ID;
  if (kalyoBotId) return botId === kalyoBotId;
  return Boolean(process.env.KALYO_SUPABASE_URL && process.env.KALYO_SUPABASE_SERVICE_KEY);
}

export async function touchConversation(
  supabase: SupabaseClient,
  conversationId: string,
  at: string = new Date().toISOString(),
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ last_message_at: at })
    .eq('id', conversationId);
  if (error) {
    console.error('[conversation] failed to update last_message_at', { conversationId, error });
  }
}

export type FirstUserMessage = {
  content: string;
  created_at: string;
};

export function getLeadTimezone(phone: string): string {
  const normalized = phone.trim();
  if (normalized.startsWith('+52')) return 'America/Mexico_City';
  if (normalized.startsWith('+57')) return 'America/Bogota';
  if (normalized.startsWith('+54')) return 'America/Argentina/Buenos_Aires';
  if (normalized.startsWith('+56')) return 'America/Santiago';
  if (normalized.startsWith('+51')) return 'America/Lima';
  return 'America/Mexico_City';
}

export function getLocalHour(timeZone: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(at);
  return parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
}

/** True when local time is between 9:00 and 20:00 (inclusive of the 8 PM hour). */
export function isLeadBusinessHours(phone: string, at: Date = new Date()): boolean {
  const hour = getLocalHour(getLeadTimezone(phone), at);
  return hour >= 9 && hour < 20;
}

export async function getFirstUserMessageWithTimestamp(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<FirstUserMessage | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('content, created_at')
    .eq('conversation_id', conversationId)
    .eq('role', 'user')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[conversation] failed to load first user message', { conversationId, error });
    return null;
  }
  if (!data?.content || !data.created_at) return null;
  return { content: data.content, created_at: data.created_at };
}

export async function getFirstUserMessage(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<string | null> {
  const row = await getFirstUserMessageWithTimestamp(supabase, conversationId);
  return row?.content ?? null;
}

export function buildFollowupMessage(firstUserMessage: string | null): string {
  const text = (firstUserMessage ?? '').toLowerCase();

  if (isAdPrefillMessage(text) || /psi|psic[oó]log|evaluaci[oó]n/i.test(text)) {
    return (
      'Hola 👋 Vi que te interesa Kalyo para tu práctica. ' +
      '¿Te quedó alguna duda sobre las evaluaciones clínicas o quieres que te active la prueba gratis de 15 días?'
    );
  }

  if (/precio|plan|costo|\$|usd|suscri/i.test(text)) {
    return (
      'Hola 👋 ¿Pudiste revisar los planes de Kalyo? ' +
      'Si quieres, te explico cuál conviene más para tu caso o activo tu prueba Pro gratis de 15 días.'
    );
  }

  if (/prueba|trial|gratis|gratuit/i.test(text)) {
    return (
      'Hola 👋 ¿Seguiste con la prueba gratis de Kalyo? ' +
      'Si ya te registraste, escríbeme tu email y activo tu Pro de 15 días al instante. Entra en https://app.kalyo.io/login cuando quieras.'
    );
  }

  return (
    'Hola 👋 ¿Pudiste revisar la información sobre Kalyo? ' +
    'Si quieres, puedo activarte tu prueba gratuita de 15 días ahora mismo — sin tarjeta de crédito. ¿Te interesa?'
  );
}

export type ConversationFunnelStats = {
  periodDays: number;
  totalConversations: number;
  ghostConversations: number;
  engagedConversations: number;
  leadsCaptured: number;
  followupsSent: number;
  closedConversations: number;
  ghostRate: number;
  engagementRate: number;
  leadRate: number;
};

export async function loadConversationFunnelStats(
  supabase: SupabaseClient,
  days: number,
  botId?: string,
): Promise<ConversationFunnelStats> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString();

  let q = supabase
    .from('conversation_summary')
    .select('message_count, lead_captured, followup_sent, is_closed')
    .gte('last_message_at', sinceISO);

  if (botId) q = q.eq('bot_id', botId);

  const { data, error } = await q;
  if (error) throw error;

  const rows = data ?? [];
  const total = rows.length;
  const ghosts = rows.filter((r) => r.message_count === 2).length;
  const engaged = rows.filter((r) => r.message_count > 2).length;
  const leads = rows.filter((r) => r.lead_captured).length;
  const followups = rows.filter((r) => r.followup_sent).length;
  const closed = rows.filter((r) => r.is_closed).length;

  return {
    periodDays: days,
    totalConversations: total,
    ghostConversations: ghosts,
    engagedConversations: engaged,
    leadsCaptured: leads,
    followupsSent: followups,
    closedConversations: closed,
    ghostRate: total ? (ghosts / total) * 100 : 0,
    engagementRate: total ? (engaged / total) * 100 : 0,
    leadRate: total ? (leads / total) * 100 : 0,
  };
}
