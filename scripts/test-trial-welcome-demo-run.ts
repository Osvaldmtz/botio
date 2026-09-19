/**
 * Tests: trial welcome demo follow-up offer (sí/no) after credentials.
 * Run: npx tsx scripts/test-trial-welcome-demo-run.ts
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve('server-only');
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeModule;

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(join(process.cwd(), '.env.local'));
loadEnvFile(join(process.cwd(), '.env.vercel.prod'));

import { formatDay1Welcome } from '../lib/trial-onboarding-messages';
import { buildDirectEnrollmentWelcomeMessage } from '../lib/kalyo-trial-messages';
import {
  buildTrialDemoFollowUpOfferMessage,
  buildTrialDemoOfferDeclineAck,
  detectTrialDemoOfferAccept,
  detectTrialDemoOfferDecline,
  isTrialDemoOfferPending,
} from '../lib/trial-welcome-demo';
import { detectDemoIntent } from '../lib/demo-intent-detector';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const welcome = formatDay1Welcome({
  trial_user_name: 'Ana',
  trial_user_email: 'ana@example.com',
  trialEndsAt: '2026-09-26T00:00:00.000Z',
  email: 'ana@example.com',
  tempPassword: 'TempPass123!',
});

assert(welcome.includes('ana@example.com'), 'welcome must include email');
assert(welcome.includes('TempPass123!'), 'welcome must include password');
assert(!welcome.includes('Responde 1, 2 o 3'), 'welcome must NOT embed calendar slots');
assert(!welcome.includes('Sí, quiero una demo'), 'welcome must NOT include demo follow-up');

const followUp = buildTrialDemoFollowUpOfferMessage();
assert(followUp.includes('demo de 20 minutos'), 'follow-up must mention 20 min demo');
assert(followUp.includes('Sí, quiero una demo'), 'follow-up must include accept option');
assert(followUp.includes('No por ahora, exploraré solo'), 'follow-up must include decline option');

assert(detectTrialDemoOfferAccept('Sí, quiero una demo'), 'accept: full phrase');
assert(detectTrialDemoOfferAccept('1'), 'accept: 1');
assert(detectTrialDemoOfferAccept('sí'), 'accept: sí');
assert(detectTrialDemoOfferAccept('quiero una demo'), 'accept: quiero una demo');
assert(detectDemoIntent('Sí, quiero una demo'), 'detectDemoIntent should match accept phrase');

assert(detectTrialDemoOfferDecline('No por ahora, exploraré solo'), 'decline: full phrase');
assert(detectTrialDemoOfferDecline('2'), 'decline: 2');
assert(detectTrialDemoOfferDecline('no'), 'decline: no');
assert(!detectTrialDemoOfferAccept('No por ahora'), 'accept must not match decline');
assert(!detectTrialDemoOfferDecline('Sí, quiero una demo'), 'decline must not match accept');

assert(
  isTrialDemoOfferPending({ trial_demo_offer_pending: true }),
  'pending flag true',
);
assert(!isTrialDemoOfferPending({}), 'pending flag absent');

const declineAck = buildTrialDemoOfferDeclineAck();
assert(declineAck.includes('Explora'), 'decline ack content');

const direct = buildDirectEnrollmentWelcomeMessage({
  fullName: 'Ana Pérez',
  email: 'ana@example.com',
  trialEndsAt: '2026-09-26T00:00:00.000Z',
  isNewAccount: true,
  tempPassword: 'TempPass123!',
  trialPlan: 'max',
});
assert(!direct.includes('Sí, quiero una demo'), 'direct welcome without demo CTA');
assert(direct.includes('app.kalyo.io/login'), 'direct welcome has login');

console.log('OK: trial welcome demo follow-up tests passed');
