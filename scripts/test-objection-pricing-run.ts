import { handleObjectionMessage } from '../lib/objection-interceptor';
import { getPaymentLink } from '../lib/kalyo-payment-links';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const testPhone = `+5299904${String(Date.now()).slice(-5)}`;
const testEmail = `objection-flow-${Date.now()}@example.com`;

console.log('Objection flow tests (offline)\n');

const maxCoupon = getPaymentLink('max', 'PRIMER50');
const proCoupon = getPaymentLink('pro', 'PRIMER50');

// Test response formatting via direct import
import { formatObjectionResponse } from '../lib/objection-responses';

const firstPrice = formatObjectionResponse('price', { isRepeat: false, priceObjectionCount: 1 });
assert(firstPrice.includes(maxCoupon), 'first response includes Max PRIMER50 link');
assert(firstPrice.includes('10 evaluaciones'), 'first response has official Starter eval count');
assert(firstPrice.includes('2 pacientes activos'), 'first response has official Starter patients');
assert(firstPrice.includes('Max'), 'first response prioritizes Max');

const secondPrice = formatObjectionResponse('price', { isRepeat: true, priceObjectionCount: 2 });
assert(secondPrice.includes(proCoupon), 'second response offers Pro with PRIMER50');
assert(!secondPrice.includes('Osvaldo'), 'second response does not handoff yet');

const thirdPrice = formatObjectionResponse('price', { isRepeat: true, priceObjectionCount: 3 });
assert(thirdPrice.includes('Osvaldo'), 'third price objection escalates to handoff');

console.log('✓ All objection flow formatting tests passed');
console.log('(DB integration tests require Supabase — run with test-objection-flow-run.ts in CI)');
