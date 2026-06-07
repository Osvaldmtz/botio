import type { SupabaseClient } from '@supabase/supabase-js';
import {
  formatDemoDateTime,
  resolveDemoDisplayTimezone,
  type DemoDisplayTimezone,
  type DemoReminderRow,
} from '@/lib/demo-reminder-messages';

export type DemoReminderNotifyEvent =
  | 'reminder_24h_sent'
  | 'reminder_1h_sent'
  | 'customer_confirmed'
  | 'customer_requested_reschedule'
  | 'customer_cancelled';

export type DemoReminderNotifyExtra = {
  cancellation_reason?: string;
};

export type DemoReminderNotifyDemo = DemoReminderRow & {
  google_meet_link?: string | null;
};

export type SendTelegramFn = (text: string) => Promise<void>;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function field(value: string | null | undefined): string {
  return escapeHtml((value ?? '—').trim() || '—');
}

function meetLink(value: string | null | undefined): string {
  const link = (value ?? '').trim();
  return link ? escapeHtml(link) : '—';
}

export function buildDemoReminderTelegramText(
  event: DemoReminderNotifyEvent,
  demo: DemoReminderNotifyDemo,
  display: DemoDisplayTimezone,
  extra?: DemoReminderNotifyExtra,
): string {
  const { dateLabel, timeLabel, timezoneLabel } = formatDemoDateTime(
    demo.scheduled_at,
    display.timezone,
    display.label,
  );
  const name = field(demo.customer_name);
  const phone = field(demo.customer_phone);
  const email = field(demo.customer_email);
  const dateTime = `${dateLabel} ${timeLabel} ${timezoneLabel}`;
  const meet = meetLink(demo.google_meet_link);

  switch (event) {
    case 'reminder_24h_sent':
      return (
        `🔔 <b>Recordatorio 24h enviado</b>\n\n` +
        `Cliente: ${name}\n` +
        `Teléfono: ${phone}\n` +
        `Email: ${email}\n` +
        `Demo: ${escapeHtml(dateLabel)}\n` +
        `⏰ ${escapeHtml(timeLabel)} ${escapeHtml(timezoneLabel)}\n\n` +
        `Esperando respuesta del cliente (1/2/3)`
      );
    case 'reminder_1h_sent':
      return (
        `⏰ <b>Recordatorio 1h enviado</b>\n\n` +
        `Cliente: ${name}\n` +
        `Teléfono: ${phone}\n` +
        `Demo en 1 hora: ${escapeHtml(dateTime)}\n` +
        `🎥 Link Meet: ${meet}\n\n` +
        `Esperando respuesta del cliente`
      );
    case 'customer_confirmed':
      return (
        `✅ <b>Cliente CONFIRMÓ asistencia</b>\n\n` +
        `Cliente: ${name}\n` +
        `Teléfono: ${phone}\n` +
        `Demo confirmada: ${escapeHtml(dateTime)}\n` +
        `🎥 Meet: ${meet}\n\n` +
        `Preparar la llamada.`
      );
    case 'customer_requested_reschedule':
      return (
        `🔄 <b>Cliente pidió REAGENDAR</b>\n\n` +
        `Cliente: ${name}\n` +
        `Teléfono: ${phone}\n` +
        `Demo original: ${escapeHtml(dateTime)}\n\n` +
        `Sofía le está ofreciendo nuevos slots. Esperar a que confirme.\n` +
        `Estado actual: pending_reschedule`
      );
    case 'customer_cancelled':
      return (
        `❌ <b>Cliente CANCELÓ demo</b>\n\n` +
        `Cliente: ${name}\n` +
        `Teléfono: ${phone}\n` +
        `Demo cancelada: ${escapeHtml(dateTime)}\n` +
        `Razón: ${field(extra?.cancellation_reason ?? 'cancelled_by_customer_via_reminder')}\n\n` +
        `Evento de Calendar cancelado.\n` +
        `Lead va a pipeline 'lost' o se mantiene en 'qualified' para re-attempt.`
      );
  }
}

async function defaultSendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;

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
    throw new Error(`${response.status}: ${body}`);
  }
}

export async function notifyDemoReminderEvent(
  event: DemoReminderNotifyEvent,
  demo: DemoReminderNotifyDemo,
  extra?: DemoReminderNotifyExtra,
  options?: {
    supabase?: SupabaseClient;
    display?: DemoDisplayTimezone;
    sendTelegram?: SendTelegramFn;
  },
): Promise<void> {
  const sendTelegram = options?.sendTelegram ?? defaultSendTelegram;

  try {
    const display =
      options?.display ??
      (options?.supabase
        ? await resolveDemoDisplayTimezone(options.supabase, demo)
        : { timezone: 'America/Mexico_City', label: 'CDMX' });

    const text = buildDemoReminderTelegramText(event, demo, display, extra);
    await sendTelegram(text);
    console.log(`[demo-reminder-notify] sent | event=${event} | demo_id=${demo.id}`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(
      `[demo-reminder-notify] failed | event=${event} | demo_id=${demo.id} | error=${error}`,
    );
  }
}
