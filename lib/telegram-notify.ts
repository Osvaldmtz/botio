import 'server-only';
import type { EnrichedLead } from '@/lib/lead-enrichment';

export type TelegramNotifyInput = {
  name?: string;
  phone?: string;
  email?: string;
  reason?: string;
  conversation_summary?: string;
  expires_at?: string;
  enriched?: EnrichedLead;
};

export type AmbassadorTelegramInput = {
  name?: string;
  phone?: string;
  email?: string;
  conversationUrl: string;
  faqId?: string;
  webinarRegistered?: boolean;
};

export type TelegramNotifyResult = { success: boolean; error?: string };

const REASON_LABELS: Record<string, string> = {
  requested_human: 'Pidió hablar con humano',
  purchase_intent: 'Intención de compra',
  new_lead: 'Nuevo lead',
  escalation: 'Escalación de conversación',
  activate_trial: 'Trial Max activado',
  trial_activated_via_botio: 'Trial activado vía Botio (cuenta nueva)',
  demo_scheduled: 'Demo agendada',
  meta_ads_ambassador: 'Lead Embajador Meta Ads',
};

function temperatureHeader(temperature: EnrichedLead['temperature'], reasonLabel: string): string {
  if (temperature === 'hot') return `🔥 <b>LEAD CALIENTE — ${reasonLabel}</b>`;
  if (temperature === 'warm') return `🟡 <b>LEAD TIBIO — ${reasonLabel}</b>`;
  return `❄️ <b>LEAD FRÍO — ${reasonLabel}</b>`;
}

function formatLocation(enriched: EnrichedLead): string {
  if (enriched.city) return `${enriched.city}, ${enriched.country}`;
  return enriched.country;
}

function formatSignals(signals: string[]): string {
  if (signals.length === 0) return '• Sin señales destacadas';
  return signals.map((s) => `• ${s.charAt(0).toUpperCase() + s.slice(1)}`).join('\n');
}

export async function sendAmbassadorLeadTelegram(
  input: AmbassadorTelegramInput,
): Promise<TelegramNotifyResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    return { success: false, error: 'missing env vars' };
  }

  const name = input.name?.trim() || '—';
  const phone = input.phone?.trim() || '—';
  const email = input.email?.trim() || '—';
  const faqId = input.faqId?.trim() || '—';
  const registered = input.webinarRegistered ? 'sí' : 'no';

  const text = [
    '🎓 <b>Nuevo lead EMBAJADOR</b>',
    '',
    `👤 <b>Nombre:</b> ${name}`,
    `📱 <b>WhatsApp:</b> ${phone}`,
    `📧 <b>Email:</b> ${email}`,
    '📍 <b>Source:</b> meta_ads_ambassador',
    `🎤 <b>Webinar registrado:</b> ${registered}`,
    `💬 <b>Preguntó:</b> ${faqId}`,
    `🔗 <b>Conversación:</b> <a href="${input.conversationUrl}">Abrir en Botio</a>`,
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
      return { success: false, error: `${response.status}: ${body}` };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

export async function sendLeadTelegram(
  input: TelegramNotifyInput,
): Promise<TelegramNotifyResult> {
  console.log('[telegram-notify] starting...');
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[telegram-notify] missing env vars (TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID)');
    return { success: false, error: 'missing env vars' };
  }
  console.log('[telegram-notify] env vars present, sending...');

  const reason = input.reason?.trim() || 'new_lead';
  const reasonLabel = REASON_LABELS[reason] ?? 'Notificación Kalyo';
  const enriched = input.enriched;

  const header = enriched
    ? temperatureHeader(enriched.temperature, reasonLabel)
    : (reason === 'requested_human'
        ? '🙋 <b>Lead pidió hablar con humano</b>'
        : reason === 'purchase_intent'
          ? '💰 <b>Intención de compra</b>'
          : reason === 'escalation'
            ? '⚠️ <b>Escalación de conversación</b>'
            : reason === 'activate_trial'
              ? '🎁 <b>Trial Pro activado</b>'
              : '📬 <b>Nuevo lead Kalyo</b>');

  const name = input.name?.trim() || '—';
  const phone = input.phone?.trim() || '—';
  const email = input.email?.trim() || '—';
  const summary = input.conversation_summary?.trim() || '—';

  const localeOpts: Intl.DateTimeFormatOptions = {
    timeZone: enriched?.timezone ?? 'America/Mexico_City',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };
  const dateStr = new Date().toLocaleString('es-MX', localeOpts);
  const tzLabel = enriched?.timezone?.includes('Mexico_City')
    ? 'CDMX'
    : enriched?.timezone?.includes('Bogota')
      ? 'Bogotá'
      : enriched?.country ?? '';

  const expiresLine =
    reason === 'activate_trial' && input.expires_at
      ? `\n⏳ <b>Vence:</b> ${new Date(input.expires_at).toLocaleString('es-MX', localeOpts)}`
      : '';

  const waLine =
    phone !== '—'
      ? `\n<a href="https://wa.me/${phone.replace(/^\+/, '')}">👉 Abrir chat WhatsApp</a>`
      : '';

  const sections: string[] = [header, ''];

  if (enriched) {
    sections.push(
      `👤 <b>Nombre:</b> ${name}`,
      `📞 <b>Teléfono:</b> ${phone}`,
      `📧 <b>Email:</b> ${email}`,
      `🌍 <b>Ubicación:</b> ${formatLocation(enriched)}`,
      '',
      `📊 <b>Score:</b> ${enriched.score}/100`,
      `🎯 <b>Interés:</b> ${enriched.intent}`,
      '',
      '🔍 <b>Señales detectadas:</b>',
      formatSignals(enriched.signals),
      '',
      '💬 <b>Resumen:</b>',
      summary,
      '',
      '⚡ <b>Acción recomendada:</b>',
      enriched.recommendedAction,
      '',
      `📅 ${dateStr}${tzLabel ? ` ${tzLabel}` : ''}`,
      expiresLine,
      waLine,
    );
  } else {
    sections.push(
      `👤 <b>Nombre:</b> ${name}`,
      `📱 <b>Teléfono:</b> ${phone}`,
      `📧 <b>Email:</b> ${email}`,
      `💬 <b>Resumen:</b> ${summary}`,
      `🕐 <b>Fecha:</b> ${dateStr}`,
      expiresLine,
      waLine,
    );
  }

  const text = sections.filter((l) => l !== '').join('\n');

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
      console.error('[telegram-notify] error', response.status, body);
      return { success: false, error: `${response.status}: ${body}` };
    }

    console.log('[telegram-notify] sent successfully');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[telegram-notify] error', message);
    return { success: false, error: message };
  }
}
