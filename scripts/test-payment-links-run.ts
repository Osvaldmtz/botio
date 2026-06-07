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

const withoutCoupon = formatPayIntentReply({
  trialUserName: 'Roberto',
  trialUserEmail: 'roberto@test.com',
  day15SentAt: null,
});
assert(withoutCoupon.includes(PRO_BASE), 'pay intent without coupon includes pro link');
assert(!withoutCoupon.includes('prefilled_promo_code'), 'pay intent without coupon has no promo');

const withCoupon = formatPayIntentReply({
  trialUserName: 'Roberto',
  trialUserEmail: 'roberto@test.com',
  day15SentAt: new Date().toISOString(),
});
assert(
  withCoupon.includes(`${PRO_BASE}?prefilled_promo_code=PRIMER50`),
  'pay intent after day15 includes coupon on pro',
);
assert(
  withCoupon.includes(`${MAX_BASE}?prefilled_promo_code=PRIMER50`),
  'pay intent after day15 includes coupon on max',
);

console.log('✓ All payment link tests passed');
