import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import {
  getCustomerTimezone,
  getCustomerTimezoneLabel,
} from '@/lib/timezone-from-phone';

export const HOST_TIMEZONE = process.env.DEMO_HOST_TIMEZONE ?? 'America/Bogota';

const WORK_DAYS = new Set([1, 2, 3, 4, 5, 6]);
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 20;

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

function isWithinBusinessHoursInZone(
  slotStart: Date,
  durationMinutes: number,
  timezone: string,
): boolean {
  const zoned = toZonedTime(slotStart, timezone);
  const start = {
    weekday: zoned.getDay(),
    hour: zoned.getHours(),
    minute: zoned.getMinutes(),
  };
  if (!WORK_DAYS.has(start.weekday)) return false;
  if (start.hour < WORK_START_HOUR || start.hour >= WORK_END_HOUR) return false;

  const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
  const endZoned = toZonedTime(slotEnd, timezone);
  const endHour = endZoned.getHours();
  const endMinute = endZoned.getMinutes();
  if (endHour > WORK_END_HOUR) return false;
  if (endHour === WORK_END_HOUR && endMinute > 0) return false;
  return true;
}

export function isWithinHostBusinessHours(slotStart: Date, durationMinutes: number): boolean {
  return isWithinBusinessHoursInZone(slotStart, durationMinutes, HOST_TIMEZONE);
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
  return isWithinBusinessHoursInZone(slotStart, durationMinutes, customerTimezone);
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

export function formatSlotForES(
  slotStart: Date,
  displayTimezone: string = 'America/Bogota',
  displayLabel: string = 'hora Bogotá',
): string {
  const label = formatInTimeZone(slotStart, displayTimezone, 'EEEE d MMM, HH:mm', { locale: es });
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return `${capitalized} ${displayLabel}`;
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
    if (WORK_DAYS.has(parts.weekday)) {
      for (let hour = WORK_START_HOUR; hour < WORK_END_HOUR; hour++) {
        for (const minute of [0, 30]) {
          const slotStart = hostLocalToDate(parts.year, parts.month, parts.day, hour, minute);
          if (!isWithinHostBusinessHours(slotStart, durationMinutes)) continue;
          if (slotStart.getTime() >= startDate.getTime() && slotStart.getTime() <= endMs) {
            slots.push(slotStart);
          }
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
  const displayTimezone = displayTimezoneOverride ?? getCustomerTimezone(customerPhone);
  const displayLabel =
    displayLabelOverride ??
    `hora ${getCustomerTimezoneLabel(customerPhone)}`;
  return {
    label_es: formatSlotForES(slotStart, displayTimezone, displayLabel),
    display_timezone: displayTimezone,
    display_label: displayLabel,
  };
}

export function customerLocalToUtcDate(
  dateStr: string,
  timeStr: string,
  customerTimezone: string,
): Date {
  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr ?? '0', 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }
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

  const dayMonth = normalized.match(/(?:el\s+)?(\d{1,2})(?:\s+de\s+([a-z]+))?/);
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

/** Extract HH:MM (24h) from strings like "12:30", "a las 12:30", "2:30 pm". */
export function parseTimeFromText(text: string): string | null {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const match = normalized.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const ampm = match[3];
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;

  return `${pad2(hour)}:${pad2(minute)}`;
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
export const DEFAULT_DEMO_DURATION_MINUTES = 15;
