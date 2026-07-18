import {
  KALYO_TRIAL_PLAN_MAX,
  KALYO_TRIAL_PLAN_PRO,
  detectTrialPlanPreference,
  resolveTrialDbPlan,
} from '../lib/kalyo-trial-plans';
import {
  buildDirectEnrollmentWelcomeMessage,
  buildImmediateWelcomeMessage,
  buildTrialActivationSuccessMessage,
} from '../lib/kalyo-trial-messages';
import { formatDay6 } from '../lib/trial-onboarding-messages';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

console.log('Trial Max default tests\n');

assert(resolveTrialDbPlan('max') === KALYO_TRIAL_PLAN_MAX, 'default max → professional');
assert(resolveTrialDbPlan() === KALYO_TRIAL_PLAN_MAX, 'omit plan → professional');
assert(resolveTrialDbPlan('pro') === KALYO_TRIAL_PLAN_PRO, 'explicit pro → starter');

assert(detectTrialPlanPreference('quiero trial pro') === 'pro', 'detect trial pro');
assert(detectTrialPlanPreference('quiero el trial') === 'max', 'generic trial → max');
assert(detectTrialPlanPreference('prefiero pro por favor') === 'pro', 'prefiero pro');

const welcome = buildImmediateWelcomeMessage('Ana', {
  trialPlan: 'max',
  email: 'ana@test.com',
  tempPassword: 'Kalyo-2026-ABCD',
  trialEndsAt: '2026-07-23T00:00:00.000Z',
});
assert(welcome.includes('trial Max'), 'welcome mentions trial Max');
assert(welcome.includes('Sofía'), 'welcome from Sofía');
assert(welcome.includes('Kalyo-2026-ABCD'), 'welcome includes password');

const activation = buildTrialActivationSuccessMessage({
  email: 'ana@test.com',
  fullName: 'Ana',
  trialEndsAt: '2026-07-23T00:00:00.000Z',
  trialPlan: 'max',
  tempPassword: 'Kalyo-2026-ABCD',
});
assert(activation.includes('trial Max'), 'activation message says Max');
assert(activation.includes('Kalyo-2026-ABCD'), 'activation includes password');

const directWelcome = buildDirectEnrollmentWelcomeMessage({
  fullName: 'Ana',
  email: 'ana@test.com',
  trialEndsAt: '2026-07-23T00:00:00.000Z',
  isNewAccount: true,
  tempPassword: 'Kalyo-2026-ABCD',
  trialPlan: 'max',
});
assert(directWelcome.includes('trial Max'), 'direct welcome says Max');
assert(directWelcome.includes('Sofía'), 'direct welcome from Sofía');
assert(directWelcome.includes('primer paciente'), 'direct welcome first step');

const day6 = formatDay6({ trial_user_email: 'ana@test.com', trial_user_name: 'Ana' });
assert(day6.includes('trial Max termina'), 'day 6 mentions trial Max');
assert(day6.includes('Max') && day6.includes('Pro'), 'day 6 asks Max vs Pro');
assert(!day6.includes('PRIMER50'), 'day 6 has no coupon');

const proWelcome = buildDirectEnrollmentWelcomeMessage({
  fullName: 'Ana',
  email: 'ana@test.com',
  trialEndsAt: '2026-07-23T00:00:00.000Z',
  isNewAccount: true,
  tempPassword: 'Kalyo-2026-ABCD',
  trialPlan: 'pro',
});
assert(proWelcome.includes('trial Pro'), 'explicit pro welcome says Pro');
assert(!proWelcome.includes('Agenda + Kalyo Meet'), 'pro welcome skips Max feature block');

console.log('✓ All trial Max default tests passed');
