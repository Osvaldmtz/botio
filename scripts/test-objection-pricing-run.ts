import { formatObjectionResponse } from '../lib/objection-responses';
import { getPaymentLink } from '../lib/kalyo-payment-links';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

console.log('Objection flow tests (offline)\n');

const maxLink = getPaymentLink('max');
const proLink = getPaymentLink('pro');
const maxCoupon = getPaymentLink('max', 'PRIMER50');

const firstPrice = formatObjectionResponse('price', { isRepeat: false, priceObjectionCount: 1 });
assert(firstPrice.includes('7 días'), 'first response offers trial');
assert(firstPrice.includes('gratis'), 'first response mentions free trial');
assert(!firstPrice.includes('PRIMER50'), 'first response does not mention PRIMER50');
assert(firstPrice.includes('¿Te activo el trial?'), 'first response asks to activate trial');

const secondPrice = formatObjectionResponse('price', { isRepeat: true, priceObjectionCount: 2 });
assert(secondPrice.includes(maxLink), 'second response includes full-price Max link');
assert(secondPrice.includes(proLink), 'second response includes full-price Pro link');
assert(!secondPrice.includes('PRIMER50'), 'second response does not mention PRIMER50');
assert(!secondPrice.includes('Osvaldo'), 'second response does not handoff yet');

const thirdPrice = formatObjectionResponse('price', { isRepeat: true, priceObjectionCount: 3 });
assert(thirdPrice.includes(maxCoupon), 'third response offers PRIMER50 as last resort');
assert(!thirdPrice.includes('Osvaldo'), 'third response does not handoff yet');

const fourthPrice = formatObjectionResponse('price', { isRepeat: true, priceObjectionCount: 4 });
assert(fourthPrice.includes('Osvaldo'), 'fourth price objection escalates to handoff');

console.log('✓ All objection flow formatting tests passed');
