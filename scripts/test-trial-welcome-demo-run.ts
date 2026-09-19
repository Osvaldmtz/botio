/**
 * Tests: trial welcome with optional demo slots.
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
  fetchTrialWelcomeDemoSlots,
  formatTrialWelcomeDemoBlock,
} from '../lib/trial-welcome-demo';
import { parseSlotChoice } from '../lib/demo-flow-parsing';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const fakeSlots = [
  {
    start: '2026-09-22T15:00:00.000Z',
    end: '2026-09-22T15:30:00.000Z',
    label_es: 'Lunes 22 sep, 09:00 CDMX',
    display_timezone: 'America/Mexico_City',
    display_label: 'CDMX',
  },
  {
    start: '2026-09-22T16:00:00.000Z',
    end: '2026-09-22T16:30:00.000Z',
    label_es: 'Lunes 22 sep, 10:00 CDMX',
    display_timezone: 'America/Mexico_City',
    display_label: 'CDMX',
  },
  {
    start: '2026-09-22T17:00:00.000Z',
    end: '2026-09-22T17:30:00.000Z',
    label_es: 'Lunes 22 sep, 11:00 CDMX',
    display_timezone: 'America/Mexico_City',
    display_label: 'CDMX',
  },
];

const without = formatDay1Welcome({
  trial_user_name: 'Ana',
  trial_user_email: 'ana@example.com',
  trialEndsAt: '2026-09-26T00:00:00.000Z',
  email: 'ana@example.com',
  tempPassword: 'Temp1234!',
});
assert(without.includes('Primer paso'), 'fallback keeps primer paso');
assert(!without.includes('Tengo estos horarios'), 'no slots → no demo block');
assert(!/\bOsvaldo\b/i.test(without), 'no Osvaldo');

const withSlots = formatDay1Welcome({
  trial_user_name: 'Ana',
  trial_user_email: 'ana@example.com',
  trialEndsAt: '2026-09-26T00:00:00.000Z',
  email: 'ana@example.com',
  tempPassword: 'Temp1234!',
  demoSlots: fakeSlots,
});
assert(withSlots.includes('Para que aproveches al máximo'), 'demo intro');
assert(withSlots.includes('1. Lunes 22 sep, 09:00 CDMX'), 'slot 1');
assert(withSlots.includes('2. Lunes 22 sep, 10:00 CDMX'), 'slot 2');
assert(withSlots.includes('3. Lunes 22 sep, 11:00 CDMX'), 'slot 3');
assert(withSlots.includes('Responde 1, 2 o 3'), '1/2/3 CTA');
assert(withSlots.includes('app.kalyo.io'), 'explore alone CTA');
assert(!withSlots.includes('Primer paso'), 'primer paso replaced when slots present');
assert(!/\bOsvaldo\b/i.test(withSlots), 'no Osvaldo in slotted welcome');

const reactivated = buildDirectEnrollmentWelcomeMessage({
  fullName: 'Luis',
  email: 'luis@example.com',
  trialEndsAt: '2026-09-26T00:00:00.000Z',
  isNewAccount: false,
  demoSlots: fakeSlots,
});
assert(reactivated.includes('Reactivamos'), 'reactivated path');
assert(reactivated.includes('Tengo estos horarios'), 'reactivated also gets demo');

assert(parseSlotChoice('2') === 2, 'choice 2 parses');

const block = formatTrialWelcomeDemoBlock([]);
assert(block === '', 'empty slots → empty block');

console.log('--- example welcome with slots ---\n');
console.log(withSlots);
console.log('\n--- live Calendar fetch ---');

async function main(): Promise<void> {
  const live = await fetchTrialWelcomeDemoSlots({ customerPhone: '+525511112222' });
  console.log(`live slots: ${live.length}`);
  if (live.length > 0) {
    console.log(formatTrialWelcomeDemoBlock(live));
  } else {
    console.log('(no slots / calendar soft-fail — welcome would omit demo offer)');
  }
  console.log('\n✓ trial welcome demo tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
