import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { formatSlotTimeDual } from '@/lib/calendar-slots';
import { demoDisplayTimezone } from '@/lib/timezone-from-phone';

/** Official Kalyo demo booking URL. Prefer env override for staging experiments. */
export const DEMO_URL =
  process.env.KALYO_DEMO_BOOKING_URL ?? 'https://kalyo.io/demo';

/** User-facing host label — never a personal name. */
export const DEMO_HOST_TEAM_LABEL = 'nuestro equipo';

export function getDemoBookingUrl(): string {
  return DEMO_URL;
}

export function buildDemoSchedulingMessage(opts: {
  customerName?: string | null;
}): string {
  const greeting = opts.customerName?.trim() ? `, ${opts.customerName.trim()}` : '';

  return `¡Perfecto${greeting}! 🎯 Te agendo una demo personalizada con nuestro equipo.

📅 ${DEMO_URL}

En 30 minutos verás:
✓ Más de 200 tests psicométricos estandarizados con IA
✓ El asistente de voz Kaly en acción
✓ Cómo funciona la agenda y Kalyo Meet
✓ Reportes automáticos con interpretación IA

Los horarios están en zona horaria de CDMX.
¿Te queda alguna duda antes de agendar?`;
}

const DEFAULT_DEMO_MEET_LINK = 'https://meet.google.com/pgd-dxmb-sfk';

export function formatDemoConfirmationMessage(
  scheduledAt: Date,
  customerEmail: string,
  displayTimezone: string,
  displayLabel: string,
  meetLink: string = process.env.KALYO_DEMO_MEET_LINK?.trim() || DEFAULT_DEMO_MEET_LINK,
): string {
  const zone = demoDisplayTimezone(undefined, {
    timezone: displayTimezone,
    label: displayLabel,
  });
  const dateLabel = formatInTimeZone(scheduledAt, zone.timezone, 'EEEE d MMM', {
    locale: es,
  });
  const capitalizedDate = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  const timeLabel = formatSlotTimeDual(scheduledAt, zone.timezone, zone.label);

  return (
    '✅ ¡Demo agendada!\n\n' +
    `📅 ${capitalizedDate}\n` +
    `⏰ ${timeLabel}\n` +
    `👤 Con ${DEMO_HOST_TEAM_LABEL}\n` +
    `🎥 Meet: ${meetLink}\n` +
    `📨 Invitación enviada a ${customerEmail}\n\n` +
    'Te llegará un recordatorio 1 hora antes. ¿Algo más en lo que te pueda ayudar?'
  );
}
