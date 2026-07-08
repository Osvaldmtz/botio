export const CTA_EVENT_NAMES = [
  'cta_demo_hero',
  'cta_demo_section',
  'cta_whatsapp_landing',
  'cta_demo_confirmed',
] as const;

export type CtaEventName = (typeof CTA_EVENT_NAMES)[number];

export type CtaEventCounts = Record<CtaEventName, number>;

export type CtaDailyPoint = {
  date: string;
} & CtaEventCounts;

export type CtaEventsSummary = {
  counts: CtaEventCounts;
  daily: CtaDailyPoint[];
  conversionRate: number | null;
  totalEvents: number;
};

export function isCtaEventName(value: string): value is CtaEventName {
  return (CTA_EVENT_NAMES as readonly string[]).includes(value);
}

export function computeDemoConversionRate(counts: CtaEventCounts): number | null {
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
  };
}
