import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import {
  DEFAULT_CUSTOMER_TIMEZONE,
  DEFAULT_CUSTOMER_TIMEZONE_LABEL,
  getCustomerTimezone,
  getCustomerTimezoneLabel,
  hasPhoneTimezone,
  resolvePhoneTimezone,
} from '@/lib/timezone-from-phone';

export const HOST_TIMEZONE = process.env.DEMO_HOST_TIMEZONE ?? 'America/Bogota';

/** Product-facing reference timezone (CDMX) — used when comparing clocks / dual request labels. */
export const DEMO_DISPLAY_TIMEZONE =
  process.env.DEMO_DISPLAY_TIMEZONE ?? 'America/Mexico_City';
export const DEMO_DISPLAY_LABEL = process.env.DEMO_DISPLAY_LABEL ?? 'CDMX';

const LABEL_BY_TIMEZONE: Record<string, string> = {
  'America/Mexico_City': 'CDMX',
  'America/Bogota': 'Bogotá',
  'America/Lima': 'Lima',
  'America/Caracas': 'Caracas',
  'America/Guayaquil': 'Guayaquil',
  'America/Argentina/Buenos_Aires': 'Buenos Aires',
  'America/Santiago': 'Santiago',
  'America/Monterrey': 'Monterrey',
};

/** Customer-local window used only to estimate overlap with the person's day. */
const CUSTOMER_WORK_DAYS = new Set([1, 2, 3, 4, 5, 6]);
const CUSTOMER_WORK_START_HOUR = 9;
const CUSTOMER_WORK_END_HOUR = 20;

/** Host demo desk, America/Bogota. Weekdays 09:00–18:00, Saturday 09:00–13:00. */
export function hostDemoWindow(weekday: number): { startMin: number; endMin: number } | null {
  if (weekday >= 1 && weekday <= 5) return { startMin: 9 * 60, endMin: 18 * 60 };
  if (weekday === 6) return { startMin: 9 * 60, endMin: 13 * 60 };
  return null;
}

function stripHoraPrefix(label?: string): string {
  return (label ?? '').replace(/^hora\s+/i, '').trim();
}

function localClock(instant: Date, timezone: string): string {
  return formatInTimeZone(instant, timezone, 'HH:mm');
}

/** Customer-facing clock: "08:00 AM", "12:00 PM". */
function formatClock12(instant: Date, timezone: string): string {
  const hour24 = Number(formatInTimeZone(instant, timezone, 'H'));
  const minute = formatInTimeZone(instant, timezone, 'mm');
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${pad2(hour12)}:${minute} ${suffix}`;
}

function sameLocalClock(instant: Date, a: string, b: string): boolean {
  return localClock(instant, a) === localClock(instant, b);
}

function cityLabelFromTimezone(timezone: string): string {
  const leaf = timezone.split('/').pop() ?? timezone;
  return leaf.replace(/_/g, ' ');
}

export type HostTzParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function getHostTzParts(date: Date): HostTzParts {
  const zoned = toZonedTime(date, HOST_TIMEZONE);
  return {
    year: zoned.getFullYear(),
    month: zoned.getMonth() + 1,
    day: zoned.getDate(),
    hour: zoned.getHours(),
    minute: zoned.getMinutes(),
    weekday: zoned.getDay(),
  };
}

export function hostLocalToDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const localIso = `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:00`;
  return fromZonedTime(localIso, HOST_TIMEZONE);
}

function isWithinCustomerWindow(slotStart: Date, durationMinutes: number, timezone: string): boolean {
  const zoned = toZonedTime(slotStart, timezone);
  const start = {
    weekday: zoned.getDay(),
    hour: zoned.getHours(),
    minute: zoned.getMinutes(),
  };
  if (!CUSTOMER_WORK_DAYS.has(start.weekday)) return false;
  if (start.hour < CUSTOMER_WORK_START_HOUR || start.hour >= CUSTOMER_WORK_END_HOUR) return false;

  const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
  const endZoned = toZonedTime(slotEnd, timezone);
  const endHour = endZoned.getHours();
  const endMinute = endZoned.getMinutes();
  if (endHour > CUSTOMER_WORK_END_HOUR) return false;
  if (endHour === CUSTOMER_WORK_END_HOUR && endMinute > 0) return false;
  return true;
}

export function isWithinHostBusinessHours(slotStart: Date, durationMinutes: number): boolean {
  const start = getHostTzParts(slotStart);
  const window = hostDemoWindow(start.weekday);
  if (!window) return false;

  const startMin = start.hour * 60 + start.minute;
  if (startMin < window.startMin) return false;

  const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
  const end = getHostTzParts(slotEnd);
  if (end.year !== start.year || end.month !== start.month || end.day !== start.day) return false;
  const endMin = end.hour * 60 + end.minute;
  return endMin <= window.endMin;
}

export function getCustomerTzParts(date: Date, customerTimezone: string): HostTzParts {
  const zoned = toZonedTime(date, customerTimezone);
  return {
    year: zoned.getFullYear(),
    month: zoned.getMonth() + 1,
    day: zoned.getDate(),
    hour: zoned.getHours(),
    minute: zoned.getMinutes(),
    weekday: zoned.getDay(),
  };
}

export function isWithinCustomerBusinessHours(
  slotStart: Date,
  durationMinutes: number,
  customerTimezone: string,
): boolean {
  return isWithinCustomerWindow(slotStart, durationMinutes, customerTimezone);
}

/** Slot must fall within 9–20h Mon–Sat in both host (Cali) and customer timezones. */
export function isWithinOverlapBusinessHours(
  slotStart: Date,
  durationMinutes: number,
  customerTimezone: string,
): boolean {
  return (
    isWithinHostBusinessHours(slotStart, durationMinutes) &&
    isWithinCustomerBusinessHours(slotStart, durationMinutes, customerTimezone)
  );
}

/**
 * Demo slot line in the customer's local clock, without a city suffix.
 * The offer header names the zone ("Horarios en tu hora (CDMX)").
 * Uses date-fns-tz — never fixed offsets.
 *
 * Examples:
 *   Mexicano → "Martes 8 jun, 10:00 AM"
 *   Colombiano → "Martes 8 jun, 11:00 AM"
 */
export function formatSlotForES(
  slotStart: Date,
  customerTimezone?: string,
  _customerLabel?: string,
): string {
  const tz = customerTimezone?.trim() || DEFAULT_CUSTOMER_TIMEZONE;
  const datePart = formatInTimeZone(slotStart, tz, 'EEEE d MMM', { locale: es });
  const capitalized = datePart.charAt(0).toUpperCase() + datePart.slice(1);
  return `${capitalized}, ${formatClock12(slotStart, tz)}`;
}

/** Time line for confirmations in customer local clock: "10:00 (Bogotá)". */
export function formatSlotTimeDual(
  slotStart: Date,
  customerTimezone?: string,
  customerLabel?: string,
): string {
  const tz = customerTimezone?.trim() || DEFAULT_CUSTOMER_TIMEZONE;
  const city =
    stripHoraPrefix(customerLabel) ||
    LABEL_BY_TIMEZONE[tz] ||
    cityLabelFromTimezone(tz);
  const localTime = localClock(slotStart, tz);
  return `${localTime} (${city})`;
}

/**
 * Label when the user asked for a local time ("mañana a las 14"):
 * customer clock first, CDMX second via date-fns-tz (never manual offsets).
 * e.g. 14:00 Bogotá → "Miércoles 16 sep, 14:00 Bogotá (13:00 CDMX)"
 */
export function formatSlotForCustomerRequest(
  slotStart: Date,
  customerTimezone: string,
  customerLabel?: string,
): string {
  const datePart = formatInTimeZone(slotStart, customerTimezone, 'EEEE d MMM, HH:mm', {
    locale: es,
  });
  const capitalized = datePart.charAt(0).toUpperCase() + datePart.slice(1);
  const city =
    stripHoraPrefix(customerLabel) || cityLabelFromTimezone(customerTimezone);

  if (sameLocalClock(slotStart, customerTimezone, DEMO_DISPLAY_TIMEZONE)) {
    return `${capitalized} ${DEMO_DISPLAY_LABEL}`;
  }

  const cdmxTime = localClock(slotStart, DEMO_DISPLAY_TIMEZONE);
  return `${capitalized} ${city} (${cdmxTime} ${DEMO_DISPLAY_LABEL})`;
}

function addDaysHost(base: Date, days: number): Date {
  const p = getHostTzParts(base);
  const d = hostLocalToDate(p.year, p.month, p.day, 12, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function generateHostCandidateSlots(
  startDate: Date,
  endDate: Date,
  durationMinutes: number,
): Date[] {
  const slots: Date[] = [];
  const startParts = getHostTzParts(startDate);
  let cursor = hostLocalToDate(startParts.year, startParts.month, startParts.day, 0, 0);
  const endMs = endDate.getTime();

  while (cursor.getTime() <= endMs) {
    const parts = getHostTzParts(cursor);
    const window = hostDemoWindow(parts.weekday);
    if (window) {
      for (let minutes = window.startMin; minutes < window.endMin; minutes += 30) {
        const slotStart = hostLocalToDate(
          parts.year,
          parts.month,
          parts.day,
          Math.floor(minutes / 60),
          minutes % 60,
        );
        if (!isWithinHostBusinessHours(slotStart, durationMinutes)) continue;
        if (slotStart.getTime() >= startDate.getTime() && slotStart.getTime() <= endMs) {
          slots.push(slotStart);
        }
      }
    }
    cursor = addDaysHost(cursor, 1);
    const cp = getHostTzParts(cursor);
    cursor = hostLocalToDate(cp.year, cp.month, cp.day, 0, 0);
  }

  return slots;
}

export function toGoogleHostDateTime(date: Date): string {
  return formatInTimeZone(date, HOST_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

export function formatSlotLabelsForPhone(
  slotStart: Date,
  customerPhone?: string,
  displayTimezoneOverride?: string,
  displayLabelOverride?: string,
): { label_es: string; display_timezone: string; display_label: string } {
  const phoneZone = hasPhoneTimezone(customerPhone)
    ? resolvePhoneTimezone(customerPhone)
    : null;
  const displayTimezone =
    phoneZone?.timezone || displayTimezoneOverride?.trim() || getCustomerTimezone(customerPhone);
  const displayLabel =
    phoneZone?.label ||
    stripHoraPrefix(displayLabelOverride) ||
    getCustomerTimezoneLabel(customerPhone);
  return {
    label_es: formatSlotForES(slotStart, displayTimezone, displayLabel),
    display_timezone: displayTimezone,
    display_label: displayLabel,
  };
}

/** Three-slot offer. The header carries the zone; each line is the local clock. */
export function formatCustomerSlotOffer(
  slots: Array<{ label_es: string; display_label?: string }>,
  options?: { overlap_limited?: boolean },
): string {
  if (slots.length === 0) {
    return 'No encontré horarios disponibles en los próximos días. ¿Te funciona algún día de la próxima semana?';
  }

  const zoneLabel = slots[0]?.display_label?.trim() || DEFAULT_CUSTOMER_TIMEZONE_LABEL;
  const header = `Horarios en tu hora (${zoneLabel}):`;
  const lines = slots.map((slot, i) => `${i + 1}️⃣ ${slot.label_es}`);
  const prefix = options?.overlap_limited
    ? 'Tu zona horaria tiene poco overlap con nuestro horario laboral. Te ofrezco los horarios disponibles incluso fuera de tu rango ideal.\n\n' +
      `${header}\n`
    : `${header}\n`;

  return `${prefix}${lines.join('\n')}\n\n¿Cuál te viene mejor? Responde con 1, 2 o 3.`;
}

export function customerLocalToUtcDate(
  dateStr: string,
  timeStr: string,
  customerTimezone: string,
): Date {
  const normalized = normalizeRequestedTime(timeStr);
  if (!normalized) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }
  const [hourStr, minuteStr] = normalized.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr ?? '0', 10);
  const localIso = `${dateStr}T${pad2(hour)}:${pad2(minute)}:00`;
  return fromZonedTime(localIso, customerTimezone);
}

const WEEKDAY_NAMES: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
};

function nextWeekdayDate(currentDate: Date, targetWeekday: number): Date {
  const now = getHostTzParts(currentDate);
  const cursor = hostLocalToDate(now.year, now.month, now.day, 12, 0);
  let daysAhead = targetWeekday - now.weekday;
  if (daysAhead < 0) daysAhead += 7;
  return addDaysHost(cursor, daysAhead);
}

/** Parse natural date hints ("el lunes", "mañana", "2026-06-08") → YYYY-MM-DD in host TZ. */
export function parseRelativeDate(text: string, currentDate = new Date()): string | null {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const isoMatch = normalized.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  if (/manana/.test(normalized) && !/pasado/.test(normalized)) {
    const p = getHostTzParts(addDaysHost(currentDate, 1));
    return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
  }

  if (/pasado\s*manana/.test(normalized)) {
    const p = getHostTzParts(addDaysHost(currentDate, 2));
    return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
  }

  for (const [name, dow] of Object.entries(WEEKDAY_NAMES)) {
    if (normalized.includes(name)) {
      const d = nextWeekdayDate(currentDate, dow);
      const p = getHostTzParts(d);
      return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
    }
  }

  // "a las 9" is a clock, not the 9th. Strip times before looking for a day number.
  const withoutClock = normalized
    .replace(/\b(?:a\s+)?las\s+\d{1,2}(?::\d{2})?(?:\s*(?:am|pm|horas?|hrs?|h))?\b/g, ' ')
    .replace(/\b\d{1,2}[:.]\d{2}(?:\s*(?:am|pm))?\b/g, ' ')
    .replace(/\b\d{1,2}\s*(?:am|pm|horas?|hrs?)\b/g, ' ');

  const dayMonth = withoutClock.match(/(?:el\s+)?(\d{1,2})(?:\s+de\s+([a-z]+))?/);
  if (dayMonth) {
    const day = parseInt(dayMonth[1], 10);
    const monthNames: Record<string, number> = {
      enero: 1,
      febrero: 2,
      marzo: 3,
      abril: 4,
      mayo: 5,
      junio: 6,
      julio: 7,
      agosto: 8,
      septiembre: 9,
      octubre: 10,
      noviembre: 11,
      diciembre: 12,
      jun: 6,
    };
    const now = getHostTzParts(currentDate);
    const month = dayMonth[2] ? monthNames[dayMonth[2]] ?? now.month : now.month;
    let year = now.year;
    if (month < now.month || (month === now.month && day < now.day)) year += 1;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  return null;
}

/** Extract HH:MM (24h) from "12:30", "a las 14", "14 horas", "2 pm". */
export function parseTimeFromText(text: string): string | null {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const withMinutes = normalized.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/);
  if (withMinutes) {
    let hour = parseInt(withMinutes[1], 10);
    const minute = parseInt(withMinutes[2], 10);
    const ampm = withMinutes[3];
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return null;
    return `${pad2(hour)}:${pad2(minute)}`;
  }

  // "a las 14", "a las 14 horas", "las 14h"
  const aLas = normalized.match(
    /(?:a\s+)?las\s+(\d{1,2})\s*(?:horas?|hrs?|h)?(?:\s*(am|pm))?/,
  );
  if (aLas) {
    let hour = parseInt(aLas[1], 10);
    const ampm = aLas[2];
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    if (hour > 23) return null;
    return `${pad2(hour)}:00`;
  }

  // "14 horas", "14 hrs", "2 pm"
  const hourWord = normalized.match(/(\d{1,2})\s*(?:horas?|hrs?)\b(?:\s*(am|pm))?/);
  if (hourWord) {
    let hour = parseInt(hourWord[1], 10);
    const ampm = hourWord[2];
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    if (hour > 23) return null;
    return `${pad2(hour)}:00`;
  }

  const ampmOnly = normalized.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (ampmOnly) {
    let hour = parseInt(ampmOnly[1], 10);
    const ampm = ampmOnly[2];
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    if (hour > 23) return null;
    return `${pad2(hour)}:00`;
  }

  return null;
}

/**
 * Normalize tool/LLM time inputs ("14", "14:00", "2 pm") → HH:MM.
 * Never does timezone math — only string → clock.
 */
export function normalizeRequestedTime(timeStr: string): string | null {
  const trimmed = timeStr.trim();
  if (!trimmed) return null;

  const fromText = parseTimeFromText(trimmed) ?? parseTimeFromText(`a las ${trimmed}`);
  if (fromText) return fromText;

  if (/^\d{1,2}$/.test(trimmed)) {
    const hour = parseInt(trimmed, 10);
    if (hour >= 0 && hour <= 23) return `${pad2(hour)}:00`;
  }

  return null;
}

export function buildCalendarSlot(
  slotStart: Date,
  durationMinutes: number,
  customerPhone?: string,
  displayTimezone?: string,
  displayLabel?: string,
): {
  start: string;
  end: string;
  label_es: string;
  display_timezone: string;
  display_label: string;
} {
  const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
  const labels = formatSlotLabelsForPhone(
    slotStart,
    customerPhone,
    displayTimezone,
    displayLabel,
  );
  return {
    start: slotStart.toISOString(),
    end: slotEnd.toISOString(),
    ...labels,
  };
}

export const MIN_ADVANCE_HOURS = 12;
export const DEFAULT_DEMO_DURATION_MINUTES = 30;
