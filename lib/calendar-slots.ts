import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import {
  getCustomerTimezone,
  getCustomerTimezoneLabel,
  type CustomerTimezone,
  type CustomerTimezoneLabel,
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

export function isWithinHostBusinessHours(slotStart: Date, durationMinutes: number): boolean {
  const start = getHostTzParts(slotStart);
  if (!WORK_DAYS.has(start.weekday)) return false;
  if (start.hour < WORK_START_HOUR || start.hour >= WORK_END_HOUR) return false;

  const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
  const end = getHostTzParts(slotEnd);
  if (end.hour > WORK_END_HOUR) return false;
  if (end.hour === WORK_END_HOUR && end.minute > 0) return false;
  return true;
}

export function formatSlotForES(
  slotStart: Date,
  displayTimezone: CustomerTimezone = 'America/Bogota',
  displayLabel: CustomerTimezoneLabel = 'Bogotá',
): string {
  const label = formatInTimeZone(slotStart, displayTimezone, 'EEEE d MMM, HH:mm', { locale: es });
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return `${capitalized} hora ${displayLabel}`;
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
): { label_es: string; display_timezone: CustomerTimezone; display_label: CustomerTimezoneLabel } {
  const displayTimezone = getCustomerTimezone(customerPhone);
  const displayLabel = getCustomerTimezoneLabel(customerPhone);
  return {
    label_es: formatSlotForES(slotStart, displayTimezone, displayLabel),
    display_timezone: displayTimezone,
    display_label: displayLabel,
  };
}
