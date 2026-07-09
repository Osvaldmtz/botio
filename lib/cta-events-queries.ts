import 'server-only';
import { format, subDays } from 'date-fns';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  CTA_EVENT_LABELS,
  CTA_EVENT_NAMES,
  PLAN_CTA_EVENTS,
  computeDemoConversionRate,
  emptyCtaCounts,
  isCtaEventName,
  type CtaDailyPoint,
  type CtaEventsPageSummary,
  type CtaEventsSummary,
  type CtaSourceFilter,
} from '@/lib/cta-events-utils';

export type {
  CtaEventName,
  CtaEventCounts,
  CtaDailyPoint,
  CtaEventsSummary,
  CtaEventsPageSummary,
  CtaSourceFilter,
  CtaPlanComparisonRow,
} from '@/lib/cta-events-utils';
export {
  computeDemoConversionRate,
  isCtaEventName,
  CTA_EVENT_NAMES,
  CTA_EVENT_LABELS,
  LANDING_CTA_EVENTS,
  APP_CTA_EVENTS,
  PLAN_CTA_EVENTS,
  sumCountsFromDaily,
  sumValueFromDaily,
} from '@/lib/cta-events-utils';

type CtaEventRow = {
  event_name: string;
  event_timestamp: string;
  source: string | null;
  value_usd: number | string | null;
};

function normalizeSource(source: string | null): 'landing' | 'app' | null {
  if (source === 'landing' || source === 'app') return source;
  return null;
}

function matchesSource(row: CtaEventRow, filter: CtaSourceFilter): boolean {
  if (filter === 'all') return true;
  const normalized = normalizeSource(row.source);
  if (normalized) return normalized === filter;
  // Legacy rows without source are treated as landing
  return filter === 'landing';
}

function accumulateSummary(rows: CtaEventRow[]): CtaEventsSummary {
  const counts = emptyCtaCounts();
  let totalValueUsd = 0;

  const dailyMap = new Map<string, CtaDailyPoint>();

  for (const row of rows) {
    if (!isCtaEventName(row.event_name)) continue;

    counts[row.event_name] += 1;
    const valueUsd = Number(row.value_usd ?? 0);
    totalValueUsd += valueUsd;

    const date = format(new Date(row.event_timestamp), 'yyyy-MM-dd');
    const point = dailyMap.get(date) ?? { date, valueUsd: 0, ...emptyCtaCounts() };
    point[row.event_name] += 1;
    point.valueUsd += valueUsd;
    dailyMap.set(date, point);
  }

  const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    counts,
    daily,
    conversionRate: computeDemoConversionRate(counts),
    totalEvents: rows.filter((row) => isCtaEventName(row.event_name)).length,
    totalValueUsd,
  };
}

export async function fetchCtaEventsRaw(days: number): Promise<CtaEventRow[]> {
  const since = subDays(new Date(), days).toISOString();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('cta_events')
    .select('event_name, event_timestamp, source, value_usd')
    .gte('event_timestamp', since)
    .in('event_name', [...CTA_EVENT_NAMES])
    .order('event_timestamp', { ascending: true });

  if (error) throw error;
  return (data ?? []) as CtaEventRow[];
}

export async function fetchCtaEventsSummary(days: number, source: CtaSourceFilter = 'all'): Promise<CtaEventsSummary> {
  const rows = await fetchCtaEventsRaw(days);
  const filtered = rows.filter((row) => matchesSource(row, source));
  return accumulateSummary(filtered);
}

export async function fetchCtaEventsPageSummary(days: number): Promise<CtaEventsPageSummary> {
  const rows = await fetchCtaEventsRaw(days);

  const landingRows = rows.filter((row) => matchesSource(row, 'landing'));
  const appRows = rows.filter((row) => matchesSource(row, 'app'));

  const landing = accumulateSummary(landingRows);
  const app = accumulateSummary(appRows);
  const all = accumulateSummary(rows);

  const planComparison = PLAN_CTA_EVENTS.map((event) => {
    const sumFor = (subset: CtaEventRow[]) =>
      subset
        .filter((row) => row.event_name === event)
        .reduce((acc, row) => acc + Number(row.value_usd ?? 0), 0);

    const landingCount = landing.counts[event];
    const appCount = app.counts[event];

    return {
      event,
      label: CTA_EVENT_LABELS[event],
      landing: landingCount,
      app: appCount,
      landingValueUsd: sumFor(landingRows),
      appValueUsd: sumFor(appRows),
    };
  });

  return { landing, app, all, planComparison };
}
