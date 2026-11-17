/**
 * QA: post-trial flow (credentials → auto demo offer → sí/no).
 * No real phone/email — Twilio mocked.
 *
 * Run: npx tsx scripts/qa-post-trial-demo-flow.ts
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const require = createRequire(import.meta.url);

// Stub server-only before any lib import (tsx/CJS).
const Module = require('module') as NodeModule & {
  _load: (request: string, parent: NodeModule, isMain: boolean) => unknown;
};
const originalLoad = Module._load;
Module._load = function (request: string, parent: NodeModule, isMain: boolean) {
  if (request === 'server-only') return {};
  return originalLoad(request, parent, isMain);
};
require.cache[require.resolve('server-only')] = {
  id: 'server-only',
  filename: 'server-only',
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

type Check = { name: string; pass: boolean; detail?: string };

const PERSONAL_NAME_RE =
  /\b(osvaldo|mart[ií]nez|fundador de kalyo|osvamtz)\b/i;

const FAKE = {
  phone: '+520000000001',
  email: 'qa-post-trial@example.invalid',
  name: 'QA Tester',
  password: 'Kalyo-QA-Test-9x7',
  trialEndsAt: '2026-09-26T18:00:00.000Z',
};

function hasPersonalName(text: string): boolean {
  return PERSONAL_NAME_RE.test(text);
}

function printBlock(title: string, body: string): void {
  console.log(`\n── ${title} ──`);
  console.log(body);
  console.log('── fin ──');
}

async function main(): Promise<void> {
  const { sendWelcomeMessage } = await import('../lib/trial-onboarding-webhook');
  const { buildTrialActivationSuccessMessage } = await import('../lib/kalyo-trial-messages');
  const {
    buildTrialDemoFollowUpOfferMessage,
    buildTrialDemoOfferDeclineAck,
    detectTrialDemoOfferAccept,
    detectTrialDemoOfferDecline,
    trialActivationSucceededForDemoFollowUp,
  } = await import('../lib/trial-welcome-demo');
  const { buildDemoSchedulingMessage } = await import('../lib/demo-booking-messages');

  console.log('=== QA post-trial demo flow (mocked Twilio, fake contact) ===');
  console.log(`Fake phone: ${FAKE.phone}`);
  console.log(`Fake email: ${FAKE.email}`);

  const all: Check[] = [];

  // ── 1) Welcome path ────────────────────────────────────────────────────────
  console.log('\n### 1) Welcome path (sendWelcomeMessage) — 2 Twilio plains');
  const sent: Array<{ body: string; sid: string }> = [];
  const sleeps: number[] = [];
  let sidSeq = 0;

  const result = await sendWelcomeMessage({
    to: FAKE.phone,
    name: FAKE.name,
    creds: {
      accountSid: 'ACqa_fake',
      authToken: 'qa_fake_token',
      from: 'whatsapp:+15550000000',
    },
    email: FAKE.email,
    tempPassword: FAKE.password,
    trialPlan: 'max',
    trialEndsAt: FAKE.trialEndsAt,
    templateSid: null,
    twilio: {
      sendTemplate: async () => {
        throw new Error('template should not run when email+password present');
      },
      sendPlain: async (args) => {
        sidSeq += 1;
        const sid = `SM_qa_${sidSeq}`;
        sent.push({ body: args.body, sid });
        return { sid };
      },
      fetchStatus: async () => ({ status: 'sent' }),
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    },
  });

  all.push({
    name: 'sendWelcomeMessage success',
    pass: result.success === true,
    detail: `success=${result.success} method=${result.method}`,
  });
  all.push({
    name: 'Twilio received exactly 2 plain messages',
    pass: sent.length === 2,
    detail: `count=${sent.length}`,
  });

  const msg1 = sent[0]?.body ?? result.textBody ?? '';
  const msg2 = sent[1]?.body ?? result.demoFollowUpBody ?? '';

  all.push({
    name: 'Msg1 has credentials (email + password)',
    pass: msg1.includes(FAKE.email) && msg1.includes(FAKE.password),
  });
  all.push({
    name: 'Msg1 is trial welcome (not demo offer)',
    pass:
      /prueba gratis|cuenta.*activa|app\.kalyo\.io\/login/i.test(msg1) &&
      !msg1.includes('Sí, quiero una demo'),
  });
  all.push({
    name: 'Msg2 is automatic demo offer',
    pass:
      msg2.includes('demo de 20 minutos') &&
      msg2.includes('Sí, quiero una demo') &&
      msg2.includes('No por ahora'),
  });
  all.push({
    name: 'Follow-up sleep is 1500ms before Msg2',
    pass: sleeps.includes(1500),
    detail: `sleeps=${JSON.stringify(sleeps)}`,
  });
  all.push({
    name: 'Msg1 has no personal names',
    pass: !hasPersonalName(msg1),
  });
  all.push({
    name: 'Msg2 has no personal names',
    pass: !hasPersonalName(msg2) && msg2.includes('nuestro equipo'),
  });
  all.push({
    name: 'result.demoFollowUpBody matches Msg2',
    pass: Boolean(result.demoFollowUpBody) && result.demoFollowUpBody === msg2,
  });

  printBlock('MSG1 — credenciales', msg1);
  printBlock('MSG2 — oferta demo (automático tras sleep 1500ms)', msg2);

  // ── 2) Claude path ─────────────────────────────────────────────────────────
  console.log('\n### 2) Claude path (create_account_and_activate_trial success)');
  const credentialsMsg = buildTrialActivationSuccessMessage({
    email: FAKE.email,
    fullName: FAKE.name,
    trialEndsAt: FAKE.trialEndsAt,
    tempPassword: FAKE.password,
    trialPlan: 'max',
  });
  const followUpMsg = buildTrialDemoFollowUpOfferMessage();
  const wouldQueueFollowUp = trialActivationSucceededForDemoFollowUp(
    ['create_account_and_activate_trial'],
    {
      create_account_and_activate_trial: {
        status: 'success',
        bot_message: credentialsMsg,
      },
    },
  );

  all.push({
    name: 'Claude path: create_account success queues follow-up',
    pass: wouldQueueFollowUp,
  });
  all.push({
    name: 'Claude credentials msg has email+password',
    pass: credentialsMsg.includes(FAKE.email) && credentialsMsg.includes(FAKE.password),
  });
  all.push({
    name: 'Claude credentials msg has no personal names',
    pass: !hasPersonalName(credentialsMsg),
  });
  all.push({
    name: 'Claude follow-up is demo offer (nuestro equipo)',
    pass:
      followUpMsg.includes('nuestro equipo') &&
      followUpMsg.includes('Sí, quiero una demo') &&
      !hasPersonalName(followUpMsg),
  });

  printBlock('Claude MSG1 — bot_message credenciales', credentialsMsg);
  printBlock('Claude MSG2 — followUpMessages[0]', followUpMsg);

  // ── 3) Yes ─────────────────────────────────────────────────────────────────
  console.log('\n### 3) Usuario responde "1" (sí)');
  const accept = detectTrialDemoOfferAccept('1');
  const yesReply = buildDemoSchedulingMessage({ customerName: FAKE.name });
  all.push({ name: 'Reply "1" detected as accept', pass: accept });
  all.push({
    name: 'Yes-reply includes kalyo.io/demo link',
    pass: yesReply.includes('https://kalyo.io/demo'),
  });
  all.push({
    name: 'Yes-reply has no personal names',
    pass: !hasPersonalName(yesReply) && yesReply.includes('nuestro equipo'),
  });
  all.push({
    name: 'Yes-reply is not Calendly',
    pass: !/calendly\.com/i.test(yesReply),
  });
  printBlock('Respuesta a "1"', yesReply);

  // ── 4) No ──────────────────────────────────────────────────────────────────
  console.log('\n### 4) Usuario responde "2" (no)');
  const decline = detectTrialDemoOfferDecline('2');
  const noReply = buildTrialDemoOfferDeclineAck();
  all.push({ name: 'Reply "2" detected as decline', pass: decline });
  all.push({
    name: 'Decline ack mentions explore / later demo',
    pass: /explora/i.test(noReply) && /demo/i.test(noReply),
  });
  all.push({
    name: 'Decline ack has no personal names',
    pass: !hasPersonalName(noReply),
  });
  printBlock('Respuesta a "2"', noReply);

  // ── Results ────────────────────────────────────────────────────────────────
  console.log('\n=== RESULTS ===');
  let failed = 0;
  for (const c of all) {
    const mark = c.pass ? 'PASS' : 'FAIL';
    if (!c.pass) failed += 1;
    console.log(`${mark}  ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
  }

  const overall = failed === 0 ? 'PASS' : 'FAIL';
  console.log(`\n=== OVERALL: ${overall} (${all.length - failed}/${all.length} checks) ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('QA crashed:', err);
  process.exit(1);
});
