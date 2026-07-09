import {
  getPaymentLink,
  KALYO_PAYMENT_LINKS,
  formatPayIntentReply,
} from '../lib/kalyo-payment-links';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const PRO_BASE = 'https://buy.stripe.com/6oU5kCbIcaFS4xa7AzgQE00';
const MAX_BASE = 'https://buy.stripe.com/dRm7sK27CbJW7Jmf31gQE01';

console.log('Payment links tests\n');

assert(KALYO_PAYMENT_LINKS.pro === PRO_BASE, 'pro base URL');
assert(KALYO_PAYMENT_LINKS.max === MAX_BASE, 'max base URL');

assert(getPaymentLink('pro') === PRO_BASE, 'getPaymentLink pro without coupon');
assert(getPaymentLink('max') === MAX_BASE, 'getPaymentLink max without coupon');

assert(
  getPaymentLink('pro', 'PRIMER50') === `${PRO_BASE}?prefilled_promo_code=PRIMER50`,
  'pro coupon query param',
);
assert(
  getPaymentLink('max', 'PRIMER50') === `${MAX_BASE}?prefilled_promo_code=PRIMER50`,
  'max coupon query param',
);

const defaultPay = formatPayIntentReply({
  trialUserName: 'Roberto',
  trialUserEmail: 'roberto@test.com',
});
assert(defaultPay.includes(`${MAX_BASE}?prefilled_promo_code=PRIMER50`), 'default pay intent is Max with PRIMER50');
assert(defaultPay.indexOf('Max') < defaultPay.indexOf('Pro'), 'Max listed before Pro');

const proExplicit = formatPayIntentReply({
  trialUserName: 'Roberto',
  trialUserEmail: 'roberto@test.com',
  preferredPlan: 'pro',
});
assert(proExplicit.includes(`${PRO_BASE}?prefilled_promo_code=PRIMER50`), 'explicit Pro uses Pro link with coupon');
assert(!proExplicit.includes(MAX_BASE), 'explicit Pro reply does not include Max link');

console.log('✓ All payment link tests passed');
