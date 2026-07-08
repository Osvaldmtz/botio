import { computeDemoConversionRate, type CtaEventCounts } from '../lib/cta-events-utils';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function main(): void {
  const counts: CtaEventCounts = {
    cta_demo_hero: 10,
    cta_demo_section: 5,
    cta_whatsapp_landing: 3,
    cta_demo_confirmed: 2,
  };

  const rate = computeDemoConversionRate(counts);
  assert(rate != null && Math.abs(rate - 13.333333) < 0.01, 'conversion rate should be ~13.3%');

  const empty = computeDemoConversionRate({
    cta_demo_hero: 0,
    cta_demo_section: 0,
    cta_whatsapp_landing: 0,
    cta_demo_confirmed: 0,
  });
  assert(empty === null, 'empty starters should return null');

  console.log('[test] cta-events-queries OK');
}

main();
