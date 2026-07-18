import {
  formatDay1Welcome,
  formatDay2,
  formatDay3,
  formatDay5,
  formatDay6,
  formatDay7Expired,
  formatDay9NoCoupon,
  formatDay9WithCoupon,
  formatOnboardingMessage,
} from '../lib/trial-onboarding-messages';
import { buildTrialOnboardingTelegramText } from '../lib/trial-onboarding-notifications';
import { KALYO_PRICING } from '../lib/kalyo-pricing-data';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const trialEndsAt = '2026-07-25T03:00:00.000Z';
const user = { trial_user_name: 'María Test', trial_user_email: 'maria@test.com' };

console.log('Trial onboarding message unit tests\n');

const day1 = formatDay1Welcome({
  ...user,
  trialEndsAt,
  email: 'maria@test.com',
  tempPassword: 'Kalyo-2026-ABCD',
});
assert(day1.includes('María Test'), 'day1 name');
assert(day1.includes('maria@test.com'), 'day1 email');
assert(day1.includes('Kalyo-2026-ABCD'), 'day1 password');
assert(day1.includes('7 días'), 'day1 trial length');
assert(day1.includes('app.kalyo.io/login'), 'day1 login link');

const day1Fallback = formatDay1Welcome({
  trial_user_email: 'maria@test.com',
  trialEndsAt,
  email: 'maria@test.com',
});
assert(day1Fallback.includes('Olvidé mi contraseña'), 'day1 missing password fallback');

assert(formatDay2(user).includes('María Test'), 'day2 name');
assert(formatDay2(user).includes('patients/new'), 'day2 patients link');

assert(formatDay3(user).includes('PHQ-9'), 'day3 PHQ-9');
assert(formatDay3(user).includes('assessments/new'), 'day3 assessments link');

assert(formatDay5(user).includes('Kaly voz'), 'day5 kaly voice');
assert(formatDay5(user).includes('2 días de trial'), 'day5 days left');

assert(formatDay6(user).includes('termina mañana'), 'day6 urgency');
assert(formatDay6(user).includes('Responde MAX o PRO'), 'day6 CTA');

assert(formatDay7Expired(user).includes('venció hoy'), 'day7 expired');
assert(formatDay7Expired(user).includes('modo free'), 'day7 free mode');

const day9Coupon = formatDay9WithCoupon(user);
assert(day9Coupon.includes('PRIMER50'), 'day9 coupon code');
assert(day9Coupon.includes(String(KALYO_PRICING.discount.max_with_discount)), 'day9 max price');
assert(day9Coupon.includes(String(KALYO_PRICING.discount.pro_with_discount)), 'day9 pro price');

const day9No = formatDay9NoCoupon(user);
assert(day9No.includes('María Test'), 'day9 no coupon name');
assert(!day9No.includes('PRIMER50'), 'day9 no coupon excludes code');

assert(
  formatOnboardingMessage(3, user, trialEndsAt).includes('evaluaciones'),
  'formatOnboardingMessage day 3',
);

assert(
  buildTrialOnboardingTelegramText({ day: 9, name: 'María', email: 'maria@test.com', daysLeft: 0 }).includes(
    'Día 9',
  ),
  'telegram day 9',
);

console.log('✓ All trial onboarding message unit tests passed');
