import type { DateRange, WowNumber } from '@/lib/weekly-report/types';

const WEEK_DAYS = 7;

/** End date is yesterday (UTC) — aligns with GSC reporting lag. */
export function getWeeklyDateRange(days = WEEK_DAYS): DateRange {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export function getPreviousWeeklyDateRange(days = WEEK_DAYS): DateRange {
  const currentEnd = new Date();
  currentEnd.setUTCDate(currentEnd.getUTCDate() - 1);
  const end = new Date(currentEnd);
  end.setUTCDate(end.getUTCDate() - days);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export function computeWow(current: number, previous: number): WowNumber {
  const delta = current - previous;
  const delta_pct =
    previous !== 0 ? Math.round(((delta / previous) * 100) * 10) / 10 : current !== 0 ? null : 0;
  return { current, previous, delta, delta_pct };
}

export function roundMetric(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function pctFromRatio(ratio: number | null | undefined): number {
  return roundMetric(Number(ratio ?? 0) * 100, 2);
}
