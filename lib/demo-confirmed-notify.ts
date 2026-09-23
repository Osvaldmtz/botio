import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';

const DEFAULT_NOTIFY_EMAIL = 'osvamtz@gmail.com';
const EMAIL_FROM = 'Kalyo Alerts <hola@kalyo.io>';

export type DemoConfirmedNotifyInput = {
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  scheduledAt: Date | string;
  meetLink?: string | null;
  /** Origin of the booking */
  source: 'whatsapp_bot' | 'landing_demo' | string;
  conversationId?: string | null;
  bookingId?: string | null;
  country?: string | null;
  interest?: string | null;
};

export type DemoConfirmedNotifyResult = {
  telegram: boolean;
  email: boolean;
  telegramError?: string;
  emailError?: string;
};

function resolveNotifyEmail(): string {
  return (
    process.env.DEMO_NOTIFY_EMAIL?.trim() ||
    process.env.DEMO_HOST_EMAIL?.trim() ||
    DEFAULT_NOTIFY_EMAIL
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function field(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  return trimmed || '—';
}

function parseScheduledAt(value: Date | string): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

function formatWhen(scheduledAt: Date): { dateLabel: string; timeLabel: string; iso: string } {
  const dateLabel = formatInTimeZone(scheduledAt, 'America/Mexico_City', "EEEE d 'de' MMMM yyyy", {
    locale: es,
  });
  const timeLabel = formatInTimeZone(scheduledAt, 'America/Mexico_City', 'HH:mm', {
    locale: es,
  });
  return {
    dateLabel: dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1),
    timeLabel: `${timeLabel} CDMX`,
    iso: scheduledAt.toISOString(),
  };
}

function sourceLabel(source: string): string {
  if (source === 'landing_demo') return 'kalyo.io/demo';
  if (source === 'whatsapp_bot') return 'WhatsApp (Sofía)';
  return source;
}

function conversationUrl(conversationId: string): string {
  const adminBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://botio.dgx.agency';
  return `${adminBase}/admin/conversations/${conversationId}`;
}

export function buildDemoConfirmedTelegramText(input: DemoConfirmedNotifyInput): string {
  const when = formatWhen(parseScheduledAt(input.scheduledAt));
  const name = escapeHtml(field(input.customerName));
  const email = escapeHtml(field(input.customerEmail));
  const phone = escapeHtml(field(input.customerPhone));
  const meet = escapeHtml(field(input.meetLink));
  const source = escapeHtml(sourceLabel(input.source));

  const lines = [
    '📅 <b>Nueva demo confirmada</b>',
    '',
    `👤 <b>Nombre:</b> ${name}`,
    `📧 <b>Email:</b> ${email}`,
    `📱 <b>WhatsApp:</b> ${phone}`,
    `🗓 <b>Fecha:</b> ${escapeHtml(when.dateLabel)}`,
    `⏰ <b>Hora:</b> ${escapeHtml(when.timeLabel)}`,
    `🎥 <b>Meet:</b> ${meet}`,
    `📍 <b>Origen:</b> ${source}`,
  ];

  if (input.country?.trim()) {
    lines.push(`🌍 <b>País:</b> ${escapeHtml(input.country.trim())}`);
  }
  if (input.interest?.trim()) {
    lines.push(`🎯 <b>Interés:</b> ${escapeHtml(input.interest.trim())}`);
  }
  if (input.conversationId?.trim()) {
    lines.push(
      `🔗 <b>Conversación:</b> <a href="${conversationUrl(input.conversationId.trim())}">Abrir en Botio</a>`,
    );
  }
  if (input.bookingId?.trim()) {
    lines.push(`🆔 <b>Booking:</b> ${escapeHtml(input.bookingId.trim())}`);
  }

  return lines.join('\n');
}

export function buildDemoConfirmedEmail(input: DemoConfirmedNotifyInput): {
  subject: string;
  text: string;
} {
  const when = formatWhen(parseScheduledAt(input.scheduledAt));
  const name = field(input.customerName);
  const subject = `📅 Demo confirmada — ${name} · ${when.dateLabel} ${when.timeLabel}`;

  const lines = [
    'Nueva demo confirmada',
    '',
    `Nombre: ${name}`,
    `Email: ${field(input.customerEmail)}`,
    `WhatsApp: ${field(input.customerPhone)}`,
    `Fecha: ${when.dateLabel}`,
    `Hora: ${when.timeLabel}`,
    `Meet: ${field(input.meetLink)}`,
    `Origen: ${sourceLabel(input.source)}`,
  ];

  if (input.country?.trim()) lines.push(`País: ${input.country.trim()}`);
  if (input.interest?.trim()) lines.push(`Interés: ${input.interest.trim()}`);
  if (input.conversationId?.trim()) {
    lines.push(`Conversación: ${conversationUrl(input.conversationId.trim())}`);
  }
  if (input.bookingId?.trim()) lines.push(`Booking ID: ${input.bookingId.trim()}`);
  lines.push('', `ISO: ${when.iso}`);

  return { subject, text: lines.join('\n') };
}

async function sendDemoConfirmedTelegram(
  text: string,
): Promise<{ sent: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[demo-confirmed-notify] missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID');
    return { sent: false, error: 'missing_env' };
  }

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
      console.error('[demo-confirmed-notify] telegram failed', response.status, body);
      return { sent: false, error: `${response.status}: ${body}` };
    }

    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[demo-confirmed-notify] telegram error', message);
    return { sent: false, error: message };
  }
}

async function sendDemoConfirmedEmail(
  subject: string,
  text: string,
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[demo-confirmed-notify] RESEND_API_KEY missing — skip email');
    return { sent: false, error: 'missing_resend' };
  }

  const to = resolveNotifyEmail();

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject,
        text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[demo-confirmed-notify] email failed', response.status, body);
      return { sent: false, error: `${response.status}: ${body}` };
    }

    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[demo-confirmed-notify] email error', message);
    return { sent: false, error: message };
  }
}

/**
 * Notify sales via Telegram + email when a demo is confirmed.
 * Never throws — calendar/booking must not fail because of alerts.
 */
export async function notifyDemoConfirmed(
  input: DemoConfirmedNotifyInput,
): Promise<DemoConfirmedNotifyResult> {
  const telegramText = buildDemoConfirmedTelegramText(input);
  const { subject, text } = buildDemoConfirmedEmail(input);

  const [telegram, email] = await Promise.all([
    sendDemoConfirmedTelegram(telegramText),
    sendDemoConfirmedEmail(subject, text),
  ]);

  console.log('[demo-confirmed-notify] done', {
    telegram: telegram.sent,
    email: email.sent,
    telegramError: telegram.error,
    emailError: email.error,
    to: resolveNotifyEmail(),
    source: input.source,
  });

  return {
    telegram: telegram.sent,
    email: email.sent,
    telegramError: telegram.error,
    emailError: email.error,
  };
}
