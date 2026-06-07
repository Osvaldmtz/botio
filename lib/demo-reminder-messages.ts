import type { SupabaseClient } from '@supabase/supabase-js';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { cityToTimezone } from '@/lib/city-to-timezone';
const DEMO_HOST_TEAM_LABEL = 'Osvaldo del equipo de Kalyo';
import {
  getCustomerTimezone,
  getCustomerTimezoneLabel,
} from '@/lib/timezone-from-phone';

export type DemoReminderRow = {
  id: string;
  conversation_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  scheduled_at: string;
};

export type DemoDisplayTimezone = {
  timezone: string;
  label: string;
};

export async function resolveDemoDisplayTimezone(
  supabase: SupabaseClient,
  demo: DemoReminderRow,
): Promise<DemoDisplayTimezone> {
  if (demo.conversation_id) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('metadata, lead_city')
      .eq('id', demo.conversation_id)
      .maybeSingle();

    const metadata = (conv?.metadata as Record<string, unknown> | null) ?? {};
    const pending = metadata.pending_demo_slots;
    if (pending && typeof pending === 'object') {
      const p = pending as { customer_timezone?: string; display_label?: string };
      if (p.customer_timezone) {
        return {
          timezone: p.customer_timezone,
          label: p.display_label ?? p.customer_timezone,
        };
      }
    }

    const leadCity = typeof conv?.lead_city === 'string' ? conv.lead_city.trim() : '';
    if (leadCity) {
      const match = cityToTimezone(leadCity);
      if (match) {
        return { timezone: match.timezone, label: match.label };
      }
    }
  }

  return {
    timezone: getCustomerTimezone(demo.customer_phone),
    label: getCustomerTimezoneLabel(demo.customer_phone),
  };
}

function formatDemoDateTime(
  scheduledAt: string,
  timezone: string,
  timezoneLabel: string,
): { dateLabel: string; timeLabel: string; timezoneLabel: string } {
  const date = new Date(scheduledAt);
  const rawDate = formatInTimeZone(date, timezone, 'EEEE d MMM', { locale: es });
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
  const timeLabel = formatInTimeZone(date, timezone, 'HH:mm', { locale: es });
  return { dateLabel, timeLabel, timezoneLabel };
}

export function formatReminder24h(
  demo: DemoReminderRow,
  display: DemoDisplayTimezone,
): string {
  const { dateLabel, timeLabel, timezoneLabel } = formatDemoDateTime(
    demo.scheduled_at,
    display.timezone,
    display.label,
  );

  return (
    `👋 Hola ${demo.customer_name}, te recuerdo tu demo Kalyo mañana:\n\n` +
    `📅 ${dateLabel}\n` +
    `⏰ ${timeLabel} ${timezoneLabel}\n` +
    `👤 Con ${DEMO_HOST_TEAM_LABEL}\n` +
    `🎥 Te llegó el link de Google Meet por email\n\n` +
    `¿Sigues en pie? Responde:\n` +
    `1️⃣ Confirmar asistencia\n` +
    `2️⃣ Reagendar\n` +
    `3️⃣ Cancelar`
  );
}

export function formatReminder1h(
  demo: DemoReminderRow,
  display: DemoDisplayTimezone,
): string {
  const { timeLabel, timezoneLabel } = formatDemoDateTime(
    demo.scheduled_at,
    display.timezone,
    display.label,
  );

  return (
    `⏰ Tu demo Kalyo es en 1 hora, ${demo.customer_name}:\n\n` +
    `📅 Hoy a las ${timeLabel} ${timezoneLabel}\n` +
    `🎥 Link Google Meet en tu email (busca '${demo.customer_name}' o 'Demo Kalyo')\n\n` +
    `¡Nos vemos pronto! Si necesitas algo:\n` +
    `1️⃣ Confirmo, ahí nos vemos\n` +
    `2️⃣ Reagendar\n` +
    `3️⃣ Cancelar`
  );
}

export function formatReminderConfirmed(
  demo: DemoReminderRow,
  display: DemoDisplayTimezone,
): string {
  const { dateLabel, timeLabel, timezoneLabel } = formatDemoDateTime(
    demo.scheduled_at,
    display.timezone,
    display.label,
  );

  return (
    `✅ ¡Perfecto, ${demo.customer_name}! Te esperamos en tu demo el ${dateLabel} a las ${timeLabel} ${timezoneLabel}. Nos vemos pronto 👋`
  );
}
