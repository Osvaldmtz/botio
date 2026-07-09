export const LANDING_CTA_EVENTS = [
  'cta_demo_hero',
  'cta_demo_section',
  'cta_whatsapp_landing',
  'cta_demo_confirmed',
] as const;

export const APP_CTA_EVENTS = [
  'cta_plan_pro',
  'cta_plan_max',
  'cta_plan_ultra',
  'cta_kaly_voice_used',
  'cta_first_patient',
  'cta_first_test',
  'cta_first_report',
] as const;

export const PLAN_CTA_EVENTS = [
  'cta_plan_pro',
  'cta_plan_max',
  'cta_plan_ultra',
] as const;

export const CTA_EVENT_NAMES = [...LANDING_CTA_EVENTS, ...APP_CTA_EVENTS] as const;

export type CtaEventName = (typeof CTA_EVENT_NAMES)[number];
export type LandingCtaEventName = (typeof LANDING_CTA_EVENTS)[number];
export type AppCtaEventName = (typeof APP_CTA_EVENTS)[number];
export type CtaSourceFilter = 'landing' | 'app' | 'all';

export type CtaEventCounts = Record<CtaEventName, number>;

export type CtaDailyPoint = {
  date: string;
  valueUsd: number;
} & CtaEventCounts;

export type CtaEventsSummary = {
  counts: CtaEventCounts;
  daily: CtaDailyPoint[];
  conversionRate: number | null;
  totalEvents: number;
  totalValueUsd: number;
};

export type CtaPlanComparisonRow = {
  event: CtaEventName;
  label: string;
  landing: number;
  app: number;
  landingValueUsd: number;
  appValueUsd: number;
};

export type CtaEventsPageSummary = {
  landing: CtaEventsSummary;
  app: CtaEventsSummary;
  all: CtaEventsSummary;
  planComparison: CtaPlanComparisonRow[];
};

const CTA_VALUE_USD: Partial<Record<CtaEventName, number>> = {
  cta_demo_confirmed: 30,
  cta_plan_pro: 29,
  cta_plan_max: 39,
  cta_plan_ultra: 69,
  cta_whatsapp_landing: 5,
};

export const CTA_EVENT_LABELS: Record<CtaEventName, string> = {
  cta_demo_hero: 'Demo Hero',
  cta_demo_section: 'Demo Section',
  cta_whatsapp_landing: 'WhatsApp',
  cta_demo_confirmed: 'Demo Confirmada',
  cta_plan_pro: 'Plan Pro',
  cta_plan_max: 'Plan Max',
  cta_plan_ultra: 'Plan Ultra',
  cta_kaly_voice_used: 'Kaly Voz (1er uso)',
  cta_first_patient: 'Primer paciente',
  cta_first_test: 'Primer test',
  cta_first_report: 'Primer reporte',
};

export function isCtaEventName(value: string): value is CtaEventName {
  return (CTA_EVENT_NAMES as readonly string[]).includes(value);
}

export function isLandingCtaEventName(value: string): value is LandingCtaEventName {
  return (LANDING_CTA_EVENTS as readonly string[]).includes(value);
}

export function isAppCtaEventName(value: string): value is AppCtaEventName {
  return (APP_CTA_EVENTS as readonly string[]).includes(value);
}

export function getCtaValueUsd(eventName: string): number {
  if (!isCtaEventName(eventName)) return 0;
  return CTA_VALUE_USD[eventName] ?? 0;
}

export function computeDemoConversionRate(counts: Pick<CtaEventCounts, 'cta_demo_hero' | 'cta_demo_section' | 'cta_demo_confirmed'>): number | null {
  const starters = counts.cta_demo_hero + counts.cta_demo_section;
  if (starters === 0) return null;
  return (counts.cta_demo_confirmed / starters) * 100;
}

export function emptyCtaCounts(): CtaEventCounts {
  return {
    cta_demo_hero: 0,
    cta_demo_section: 0,
    cta_whatsapp_landing: 0,
    cta_demo_confirmed: 0,
    cta_plan_pro: 0,
    cta_plan_max: 0,
    cta_plan_ultra: 0,
    cta_kaly_voice_used: 0,
    cta_first_patient: 0,
    cta_first_test: 0,
    cta_first_report: 0,
  };
}

export function sumCountsFromDaily(daily: CtaDailyPoint[]): CtaEventCounts {
  return daily.reduce(
    (acc, row) => {
      for (const key of CTA_EVENT_NAMES) {
        acc[key] += row[key];
      }
      return acc;
    },
    emptyCtaCounts(),
  );
}

export function sumValueFromDaily(daily: CtaDailyPoint[]): number {
  return daily.reduce((acc, row) => acc + row.valueUsd, 0);
}
