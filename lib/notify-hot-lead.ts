import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EnrichedLead, ConversationMessage } from '@/lib/lead-enrichment';

const HOT_ALERT_PREFIX = 'hot_alert:';
const RE_ALERT_MS = 24 * 60 * 60 * 1000;

type ConversationRow = {
  id: string;
  customer_phone: string;
  lead_signals: string[] | null;
};

function parseHotAlertAt(signals: string[] | null | undefined): Date | null {
  if (!signals?.length) return null;
  for (const signal of signals) {
    if (signal.startsWith(HOT_ALERT_PREFIX)) {
      const iso = signal.slice(HOT_ALERT_PREFIX.length);
      const date = new Date(iso);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  return null;
}

function shouldSendHotAlert(signals: string[] | null | undefined): boolean {
  const lastSent = parseHotAlertAt(signals);
  if (!lastSent) return true;
  return Date.now() - lastSent.getTime() >= RE_ALERT_MS;
}

function lastUserMessage(messages: ConversationMessage[], maxLen = 200): string {
  const users = messages.filter((m) => m.role === 'user');
  const last = users[users.length - 1];
  if (!last) return '—';
  const text = last.content.trim();
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

export async function notifyHotLeadInstant(
  supabase: SupabaseClient,
  conversation: ConversationRow,
  enrichment: EnrichedLead,
  messages: ConversationMessage[],
  name?: string,
): Promise<void> {
  if (enrichment.score < 70 || enrichment.temperature !== 'hot') return;

  const signals = Array.isArray(conversation.lead_signals)
    ? conversation.lead_signals
    : [];

  if (!shouldSendHotAlert(signals)) {
    console.log(`[hot-lead-alert] skipped — already sent for conv=${conversation.id}`);
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[hot-lead-alert] missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID');
    return;
  }

  const phone = conversation.customer_phone;
  const displayName = name?.trim() || phone;
  const city = enrichment.city ?? '—';
  const country = enrichment.country ?? '—';
  const signalBullets = enrichment.signals.length
    ? enrichment.signals.map((s) => `• ${s}`).join('\n')
    : '• Sin señales adicionales';
  const lastMsg = lastUserMessage(messages);

  const text = [
    '🔥 <b>LEAD HOT DETECTADO</b>',
    '',
    `<b>Nombre:</b> ${displayName}`,
    `<b>Teléfono:</b> ${phone}`,
    `<b>Score:</b> ${enrichment.score}/100`,
    `<b>Temperatura:</b> 🔥 HOT`,
    `<b>Ciudad:</b> ${city}`,
    `<b>País:</b> ${country}`,
    `<b>Intención:</b> ${enrichment.intent}`,
    '',
    '<b>Señales detectadas:</b>',
    signalBullets,
    '',
    '<b>Último mensaje del usuario:</b>',
    `"<i>${lastMsg}</i>"`,
    '',
    `<b>Acción recomendada:</b> ${enrichment.recommendedAction}`,
    '',
    '👉 <a href="https://botio.dgx.agency/admin/conversations">Tomar control AHORA</a>',
  ].join('\n');

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
      return;
    }

    const updatedSignals = [
      ...signals.filter((s) => !s.startsWith(HOT_ALERT_PREFIX)),
      `${HOT_ALERT_PREFIX}${new Date().toISOString()}`,
    ];

    await supabase
      .from('conversations')
      .update({ lead_signals: updatedSignals })
      .eq('id', conversation.id);

    console.log(`[hot-lead-alert] sent for conv=${conversation.id} score=${enrichment.score}`);
  } catch (error) {
    console.error('[hot-lead-alert] error', error);
  }
}
