import {
  getHostTzParts,
  hostLocalToDate,
  isWithinHostBusinessHours,
} from '@/lib/calendar-slots';

export const DEMO_SLOT_DURATION_MINUTES = 30;
export const DEMO_GAP_MINUTES = 30;
export const WEEKDAY_DAILY_MAX = 5;
export const SATURDAY_DAILY_MAX = 2;
export const BUSINESS_DAYS_BEFORE_SATURDAY = 3;

export const COLOMBIA_TIME_LABEL = 'hora de Colombia';

export type OccupiedInterval = {
  start: Date;
  end: Date;
};

export type AvailabilityContext = {
  /** Rows in scheduled_demos and demo_bookings. Daily caps use only these. */
  bookings: OccupiedInterval[];
  /** Google Calendar freebusy blocks. */
  busy: OccupiedInterval[];
  /** Instant used to find the next business days (usually now). */
  reference: Date;
  durationMinutes: number;
};

export type SlotBlockReason =
  | 'outside_hours'
  | 'morning_closed'
  | 'daily_max'
  | 'afternoon_locked'
  | 'saturday_locked'
  | 'conflict';

export class DemoSlotUnavailableError extends Error {
  readonly reason: SlotBlockReason;

  constructor(reason: SlotBlockReason, message: string) {
    super(message);
    this.name = 'DemoSlotUnavailableError';
    this.reason = reason;
  }
}

export function colombiaDayKey(date: Date): string {
  const parts = getHostTzParts(date);
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
}

export function isWeekday(date: Date): boolean {
  const weekday = getHostTzParts(date).weekday;
  return weekday >= 1 && weekday <= 5;
}

export function isSaturday(date: Date): boolean {
  return getHostTzParts(date).weekday === 6;
}

function minutesOfDay(date: Date): number {
  const parts = getHostTzParts(date);
  return parts.hour * 60 + parts.minute;
}

/** Weekday starts from 9:00 through 15:30 Colombia, inclusive. */
export function isPreferredStart(date: Date): boolean {
  if (!isWeekday(date)) return false;
  const minutes = minutesOfDay(date);
  return minutes >= 9 * 60 && minutes <= 15 * 60 + 30;
}

/** Weekday starts from 16:00 until the desk closes. */
export function isAfternoonStart(date: Date): boolean {
  if (!isWeekday(date)) return false;
  return minutesOfDay(date) >= 16 * 60;
}

/**
 * One-off desk change for Monday 5 Oct 2026 (Colombia):
 * no demos before 13:30, and the whole afternoon is open without the usual morning quota.
 */
const MONDAY_2026_10_05 = '2026-10-05';
const MONDAY_2026_10_05_OPEN_FROM_MIN = 13 * 60 + 30;

function isMonday20261005(date: Date): boolean {
  return colombiaDayKey(date) === MONDAY_2026_10_05;
}

/**
 * One-off desk change for Saturday 3 Oct 2026 (Colombia):
 * - weekday-level daily cap (usual Saturday cap is 2)
 * - extra open desk slot at 15:30
 * - 10:00 and 13:00 stay blocked (confirmed demos in demo_bookings + Calendar)
 */
const SATURDAY_2026_10_03 = '2026-10-03';
const SATURDAY_2026_10_03_DAILY_MAX = WEEKDAY_DAILY_MAX;
const SATURDAY_2026_10_03_FORCE_BUSY_MIN = new Set([10 * 60, 13 * 60]);

function isSaturday20261003(date: Date): boolean {
  return colombiaDayKey(date) === SATURDAY_2026_10_03;
}

export function dailyMaxFor(date: Date): number | null {
  if (isSaturday20261003(date)) return SATURDAY_2026_10_03_DAILY_MAX;
  if (isWeekday(date)) return WEEKDAY_DAILY_MAX;
  if (isSaturday(date)) return SATURDAY_DAILY_MAX;
  return null;
}

export function slotBlockMessage(reason: SlotBlockReason): string {
  switch (reason) {
    case 'outside_hours':
      return 'Ese horario está fuera del horario de demos: lunes a viernes de 9:00 a 18:00, sábados de 9:00 a 13:00, hora de Colombia. Domingos no hay demos.';
    case 'morning_closed':
      return 'El lunes 5 de octubre no hay demos antes de la 1:30 p.m., hora de Colombia. Desde la 1:30 p.m. y toda la tarde sí hay horario.';
    case 'daily_max':
      return 'Ese día ya llegó al máximo de demos. ¿Te ofrezco otro día?';
    case 'afternoon_locked':
      return 'Los horarios de la tarde (desde las 16:00, hora de Colombia) se abren cuando ya hay 3 demos en la mañana de ese día.';
    case 'saturday_locked':
      return 'El sábado se ofrece cuando los próximos 3 días hábiles ya están llenos. ¿Te va un día entre semana?';
    case 'conflict':
      return 'Ese horario acaba de ocuparse. Dejamos al menos 30 minutos entre demos. ¿Probamos con otro?';
  }
}

function addDays(date: Date, days: number): Date {
  const parts = getHostTzParts(date);
  const noon = hostLocalToDate(parts.year, parts.month, parts.day, 12, 0);
  noon.setUTCDate(noon.getUTCDate() + days);
  return noon;
}

/** Next `count` Mon–Fri Colombia dates starting at `from` (that day included when it is a weekday). */
export function upcomingWeekdayKeys(from: Date, count: number): string[] {
  const keys: string[] = [];
  let cursor = from;
  for (let i = 0; i < 21 && keys.length < count; i++) {
    const parts = getHostTzParts(cursor);
    if (parts.weekday >= 1 && parts.weekday <= 5) {
      keys.push(colombiaDayKey(cursor));
    }
    cursor = addDays(cursor, 1);
  }
  return keys;
}

function onDay(intervals: OccupiedInterval[], dayKey: string): OccupiedInterval[] {
  return intervals.filter((interval) => colombiaDayKey(interval.start) === dayKey);
}

export function areNextBusinessDaysFull(ctx: AvailabilityContext): boolean {
  const keys = upcomingWeekdayKeys(ctx.reference, BUSINESS_DAYS_BEFORE_SATURDAY);
  if (keys.length < BUSINESS_DAYS_BEFORE_SATURDAY) return false;
  return keys.every((key) => onDay(ctx.bookings, key).length >= WEEKDAY_DAILY_MAX);
}

function intervalsTooClose(slotStart: Date, slotEnd: Date, occupied: OccupiedInterval): boolean {
  const gapMs = DEMO_GAP_MINUTES * 60_000;
  return (
    slotStart.getTime() < occupied.end.getTime() + gapMs &&
    occupied.start.getTime() < slotEnd.getTime() + gapMs
  );
}

export function slotBlockReason(
  slotStart: Date,
  ctx: AvailabilityContext,
): SlotBlockReason | null {
  const duration = ctx.durationMinutes;
  if (!isWithinHostBusinessHours(slotStart, duration)) return 'outside_hours';

  if (isMonday20261005(slotStart) && minutesOfDay(slotStart) < MONDAY_2026_10_05_OPEN_FROM_MIN) {
    return 'morning_closed';
  }

  if (isSaturday20261003(slotStart) && SATURDAY_2026_10_03_FORCE_BUSY_MIN.has(minutesOfDay(slotStart))) {
    return 'conflict';
  }

  const dayKey = colombiaDayKey(slotStart);
  const dayBookings = onDay(ctx.bookings, dayKey);
  const max = dailyMaxFor(slotStart);
  if (max == null || dayBookings.length >= max) return 'daily_max';

  if (isSaturday(slotStart) && !isSaturday20261003(slotStart) && !areNextBusinessDaysFull(ctx)) {
    return 'saturday_locked';
  }

  const slotEnd = new Date(slotStart.getTime() + duration * 60_000);
  const occupied = [...ctx.bookings, ...ctx.busy];
  if (occupied.some((interval) => intervalsTooClose(slotStart, slotEnd, interval))) {
    return 'conflict';
  }

  return null;
}

function byStart(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

function spreadByDay(slots: Date[]): Date[] {
  const groups = new Map<string, Date[]>();
  for (const slot of [...slots].sort(byStart)) {
    const key = colombiaDayKey(slot);
    const list = groups.get(key) ?? [];
    list.push(slot);
    groups.set(key, list);
  }
  const days = Array.from(groups.keys()).sort();
  const ordered: Date[] = [];
  let index = 0;
  while (ordered.length < slots.length) {
    let added = false;
    for (const day of days) {
      const slot = groups.get(day)?.[index];
      if (slot) {
        ordered.push(slot);
        added = true;
      }
    }
    if (!added) break;
    index += 1;
  }
  return ordered;
}

/** Preferred weekday slots first, then unlocked afternoon, then Saturday. */
export function pickPrioritySlots(slots: Date[], max = 3): Date[] {
  const preferred = spreadByDay(slots.filter((slot) => isPreferredStart(slot)));
  const afternoon = spreadByDay(slots.filter((slot) => isAfternoonStart(slot)));
  const saturday = spreadByDay(slots.filter((slot) => isSaturday(slot)));
  const ordered = [...preferred, ...afternoon, ...saturday];
  const picked: Date[] = [];
  for (const slot of ordered) {
    if (picked.length >= max) break;
    if (!picked.some((existing) => existing.getTime() === slot.getTime())) picked.push(slot);
  }
  return picked;
}
