/**
 * Regression: Sofía demo as 2nd path (cache, soft intent, objections, no proper names).
 * Run: npx tsx scripts/test-demo-second-path-run.ts
 */
import { checkCache } from '../lib/response-cache';
import { detectDemoIntent } from '../lib/demo-intent-detector';
import { PROFILE_FLOWS, buildProfilePromptBlock } from '../lib/profile-flows';
import { formatObjectionResponse } from '../lib/objection-responses';
import { buildDemoSchedulingMessage } from '../lib/demo-booking-messages';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertNoProperNames(text: string, label: string): void {
  assert(!/\bOsvaldo\b/i.test(text), `${label} must not mention Osvaldo: ${text.slice(0, 120)}`);
  assert(!/\bfundador\b/i.test(text), `${label} must not mention fundador: ${text.slice(0, 120)}`);
}

// 1) Saludo 4 opciones
const saludo = checkCache('hola', [{ role: 'user', content: 'hola' }]);
assert(saludo?.pattern === 'saludo', 'saludo cache miss');
assert(saludo!.response.includes('1️⃣ Evaluaciones clínicas'), 'missing opt 1');
assert(saludo!.response.includes('3️⃣ Prueba gratis (rápido, sin tarjeta)'), 'missing opt 3 label');
assert(saludo!.response.includes('4️⃣ Demo online (30 min)'), 'missing opt 4');
assertNoProperNames(saludo!.response, 'saludo');

const q4 = checkCache('4', [
  { role: 'user', content: 'hola' },
  { role: 'assistant', content: 'hi' },
  { role: 'user', content: '4' },
]);
assert(q4?.pattern === 'quick_4', 'quick_4 miss');
assert(q4!.response.includes('https://kalyo.io/demo'), 'quick_4 needs demo link');
assertNoProperNames(q4!.response, 'quick_4');

// 2) Soft intents
assert(detectDemoIntent('Ver cómo funciona'), 'soft: ver cómo funciona');
assert(detectDemoIntent('me lo enseñas'), 'soft: me lo enseñas');
assert(detectDemoIntent('comparación en vivo'), 'soft: comparación en vivo');
assert(detectDemoIntent('puedo verlo primero'), 'soft: puedo verlo primero');
assert(detectDemoIntent('quiero conocerlo antes'), 'soft: quiero conocerlo antes');
assert(detectDemoIntent('Quiero una demo'), 'hard: quiero una demo');

// 3) Ecuador false positive
assert(
  !detectDemoIntent('Como puedo agendar una consulta presencial x q vivo en Ecuador'),
  'presencial must NOT trigger demo',
);
assert(!detectDemoIntent('cita presencial en Portoviejo'), 'cita presencial excluded');

// 4) private_practice passive
assert(PROFILE_FLOWS.private_practice.offer_demo === 'passive', 'private_practice passive');
const profileBlock = buildProfilePromptBlock('private_practice');
assert(profileBlock.includes('pasiva'), 'profile prompt must say pasiva');
assert(profileBlock.includes('kalyo.io/demo'), 'profile prompt must include demo link');

// 5) Objections include demo link
const price = formatObjectionResponse('price', { isRepeat: false });
assert(price.includes('https://kalyo.io/demo'), 'price objection needs demo link');
assertNoProperNames(price, 'price objection');

const notUseful = formatObjectionResponse('not_useful', { isRepeat: false });
assert(notUseful.includes('https://kalyo.io/demo'), 'not_useful needs demo link');
assertNoProperNames(notUseful, 'not_useful objection');

const booking = buildDemoSchedulingMessage({ customerName: 'Ana' });
assert(booking.includes('demo online'), 'booking message demo online');
assert(booking.includes('https://kalyo.io/demo') || booking.includes('kalyo.io/demo'), 'booking link');
assertNoProperNames(booking, 'booking message');

console.log('✓ All demo second-path tests passed');
