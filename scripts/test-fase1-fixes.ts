#!/usr/bin/env tsx
/**
 * Fase 1 fixes — regression tests (13 jun 2026)
 * Run: npx tsx scripts/test-fase1-fixes.ts
 */

import { detectDemoIntent } from '../lib/demo-intent-detector';
import { buildDemoSchedulingMessage, getDemoBookingUrl } from '../lib/demo-booking-messages';
import { detectAmbassadorIntent, isLikelyClientPsychologist } from '../lib/intent-detector';
import { matchesAmbassadorFaqSignal } from '../lib/embajador-faqs';
import {
  KALYO_TOTAL_EVALUATIONS,
  buildPricingSummary,
  buildProSummary,
  buildStarterSummary,
} from '../lib/kalyo-pricing-data';
import {
  clearDebounceLocksForTests,
  processWithDebounce,
} from '../lib/message-debouncer';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT FAIL: ${message}`);
}

function shouldMarkAmbassadorLead(message: string): boolean {
  if (isLikelyClientPsychologist(message)) return false;
  return detectAmbassadorIntent(message) === 'embajador_program' || matchesAmbassadorFaqSignal(message);
}

const EXPLICIT_AMBASSADOR_SIGNAL =
  /\b(embajador|comisi[óo]n|ganar\s+dinero|webinar\s+embajador|programa\s+de\s+embajadores|afiliado)\b/i;

function wouldForceIntroFallback(message: string, wasJustDetected: boolean, webinarSent: boolean): boolean {
  if (!wasJustDetected || webinarSent) return false;
  if (!shouldMarkAmbassadorLead(message)) return false;
  return EXPLICIT_AMBASSADOR_SIGNAL.test(message);
}

async function main(): Promise<void> {
  console.log('=== Fase 1 fixes — regression tests ===\n');

  // ─── Fix #1: Demo intent ─────────────────────────────────────────────────────
  assert(detectDemoIntent('Quiero una demo'), 'demo: quiero una demo');
  assert(detectDemoIntent('Agéndame una llamada'), 'demo: agendar llamada');
  assert(detectDemoIntent('Cómo hacer una cita'), 'demo: cómo hacer una cita');
  assert(detectDemoIntent('Cómo agendo'), 'demo: cómo agendo');
  assert(detectDemoIntent('Quiero una cita'), 'demo: quiero una cita');
  assert(detectDemoIntent('Si claro con Osvaldo'), 'demo: sí claro con Osvaldo');
  assert(detectDemoIntent('Cita con Osvaldo'), 'demo: cita con Osvaldo');
  assert(detectDemoIntent('Hablar con Osvaldo'), 'demo: hablar con Osvaldo');
  assert(!detectDemoIntent('Hola'), 'demo: hola excluded');
  assert(!detectDemoIntent('Información sobre Kalyo'), 'demo: info general excluded');
  assert(
    !detectDemoIntent('Cuánto cuesta una sesión con paciente?'),
    'demo: clinical session pricing excluded',
  );
  assert(!detectDemoIntent('Cuánto cuesta la demo?'), 'demo: pricing question excluded');
  const demoMsg = buildDemoSchedulingMessage({ customerName: 'Edna' });
  assert(demoMsg.includes(getDemoBookingUrl()), 'demo message includes Calendly URL');
  assert(demoMsg.includes('fundador de Kalyo'), 'demo message mentions Osvaldo as founder');
  assert(demoMsg.includes('100+'), 'demo message mentions 100+ evaluaciones');
  console.log('✓ Fix #1 — Demo intent + Calendly message');

  // ─── Fix #2: Ambassador false positives ──────────────────────────────────────
  assert(!shouldMarkAmbassadorLead('Quiero ver planes y precios'), 'FP: planes y precios');
  assert(!shouldMarkAmbassadorLead('Pregunta sobre normativa SIVIGILA'), 'FP: normativa SIVIGILA');
  assert(!isLikelyClientPsychologist('Platicame de los planes y precios'), 'FP: planes y precios phrase');
  assert(shouldMarkAmbassadorLead('Soy estudiante, quiero ser embajador'), 'TP: estudiante embajador');
  assert(shouldMarkAmbassadorLead('Quiero ganar dinero con Kalyo'), 'TP: ganar dinero');
  assert(
    wouldForceIntroFallback('Quiero ganar dinero', true, false),
    'fallback only with explicit signal',
  );
  assert(
    !wouldForceIntroFallback('Busco un ingreso extra', true, false),
    'no fallback for ingreso extra without explicit signal',
  );
  console.log('✓ Fix #2 — Ambassador false positive guard');

  // ─── Fix #3: Debounce ────────────────────────────────────────────────────────
  clearDebounceLocksForTests();
  let callCount = 0;
  const first = processWithDebounce('conv-test', async () => {
    callCount += 1;
    await new Promise((r) => setTimeout(r, 50));
    return 'ok';
  });
  const second = processWithDebounce('conv-test', async () => {
    callCount += 1;
    return 'duplicate';
  });
  const [r1, r2] = await Promise.all([first, second]);
  assert(r1 === 'ok', 'debounce: first message processed');
  assert(r2 === null, 'debounce: second message absorbed');
  assert(callCount === 1, 'debounce: handler called once');
  clearDebounceLocksForTests();
  console.log('✓ Fix #3 — Message debounce');

  // ─── Fix #5: Pricing consistency ─────────────────────────────────────────────
  const pricing = buildPricingSummary();
  assert(pricing.includes('$29 USD/mes'), 'pricing: Pro price');
  assert(pricing.includes('2 pacientes'), 'pricing: Starter patients');
  assert(pricing.includes(`${KALYO_TOTAL_EVALUATIONS}+`), 'pricing: 100+ evaluaciones');
  assert(!pricing.includes('91'), 'pricing: no 91');
  const pro = buildProSummary();
  assert(pro.includes('$29 USD/mes'), 'pro summary price');
  assert(pro.includes('100+'), 'pro summary 100+');
  const starter = buildStarterSummary();
  assert(starter.includes('2 pacientes'), 'starter: 2 pacientes');
  assert(starter.includes('20 evaluaciones'), 'starter: 20 evaluaciones');
  console.log('✓ Fix #5 — Pricing single source of truth');

  console.log('\n✅ All Fase 1 tests passed');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
