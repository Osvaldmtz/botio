import 'server-only';
import { format, subDays } from 'date-fns';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  CTA_EVENT_NAMES,
  computeDemoConversionRate,
  emptyCtaCounts,
  isCtaEventName,
  type CtaDailyPoint,
  type CtaEventsSummary,
} from '@/lib/cta-events-utils';

export type {
  CtaEventName,
  CtaEventCounts,
  CtaDailyPoint,
  CtaEventsSummary,
} from '@/lib/cta-events-utils';
export { computeDemoConversionRate, isCtaEventName, CTA_EVENT_NAMES } from '@/lib/cta-events-utils';

function accumulateCounts(rows: Array<{ event_name: string }>) {
  const counts = emptyCtaCounts();
  for (const row of rows) {
    if (isCtaEventName(row.event_name)) {
      counts[row.event_name] += 1;
    }
  }
  return counts;
}

export async function fetchCtaEventsSummary(days: number): Promise<CtaEventsSummary> {
  const since = subDays(new Date(), days).toISOString();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('cta_events')
    .select('event_name, event_timestamp')
    .gte('event_timestamp', since)
    .in('event_name', [...CTA_EVENT_NAMES])
    .order('event_timestamp', { ascending: true });

  if (error) throw error;

  const rows = data ?? [];
  const counts = accumulateCounts(rows);

  const dailyMap = new Map<string, CtaDailyPoint>();
  for (const row of rows) {
    if (!isCtaEventName(row.event_name)) continue;
    const date = format(new Date(row.event_timestamp as string), 'yyyy-MM-dd');
    const point = dailyMap.get(date) ?? { date, ...emptyCtaCounts() };
    point[row.event_name] += 1;
    dailyMap.set(date, point);
  }

  const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    counts,
    daily,
    conversionRate: computeDemoConversionRate(counts),
    totalEvents: rows.length,
  };
}
