import {
  buildImmediateWelcomeMessage,
  sendWelcomeMessage,
  type WelcomeMessageTwilioFns,
} from '../lib/trial-onboarding-webhook';

function twilioLikeError(message: string, code: number): Error {
  return Object.assign(new Error(message), { code, httpStatus: 400 });
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const creds = {
  accountSid: 'ACtest',
  authToken: 'token',
  from: '+15550001111',
};

function makeTwilioFns(overrides: Partial<WelcomeMessageTwilioFns> = {}): WelcomeMessageTwilioFns {
  return {
    sendTemplate: async () => ({ sid: 'SM_template' }),
    sendPlain: async () => ({ sid: 'SM_plain' }),
    fetchStatus: async () => ({ status: 'sent' }),
    sleep: async () => {},
    ...overrides,
  };
}

async function testTemplateNotApprovedFallsBackToPlainText(): Promise<void> {
  const calls: string[] = [];

  const result = await sendWelcomeMessage({
    to: '+52999001234',
    name: 'Roberto',
    creds,
    templateSid: 'HXtest_template',
    twilio: makeTwilioFns({
      sendTemplate: async () => {
        calls.push('template');
        throw twilioLikeError('Template not approved', 63016);
      },
      sendPlain: async () => {
        calls.push('plain');
        return { sid: 'SM_plain_ok' };
      },
      fetchStatus: async () => ({ status: 'sent' }),
    }),
  });

  assert(result.success === true, 'plain text succeeds after template rejection');
  assert(result.method === 'plain_text', 'method is plain_text');
  assert(result.sid === 'SM_plain_ok', 'plain text sid returned');
  assert(calls.join(',') === 'template,plain', 'template tried before plain text');
}

async function testNoTemplateUsesPlainTextDirectly(): Promise<void> {
  const calls: string[] = [];

  const result = await sendWelcomeMessage({
    to: '+52999001234',
    name: 'Ana',
    creds,
    templateSid: null,
    twilio: makeTwilioFns({
      sendTemplate: async () => {
        calls.push('template');
        return { sid: 'SM_should_not_run' };
      },
      sendPlain: async () => {
        calls.push('plain');
        return { sid: 'SM_plain_direct' };
      },
    }),
  });

  assert(result.success === true, 'plain text succeeds without template');
  assert(result.method === 'plain_text', 'method is plain_text');
  assert(calls.join(',') === 'plain', 'template was not attempted');
}

async function testPlainTextUndeliveredReportsFailure(): Promise<void> {
  const result = await sendWelcomeMessage({
    to: '+52999001234',
    name: 'Luis',
    creds,
    templateSid: null,
    twilio: makeTwilioFns({
      sendPlain: async () => ({ sid: 'SM_undelivered' }),
      fetchStatus: async () => ({ status: 'undelivered' }),
    }),
  });

  assert(result.success === false, 'undelivered plain text is failure');
  assert(result.method === 'plain_text', 'method is plain_text');
  assert(result.reason === 'undelivered_outside_window', 'reason explains 24h window');
}

async function testTemplateUndeliveredFallsBackToPlainText(): Promise<void> {
  let plainCalls = 0;

  const result = await sendWelcomeMessage({
    to: '+52999001234',
    name: 'María',
    creds,
    templateSid: 'HXtest_template',
    twilio: makeTwilioFns({
      sendTemplate: async () => ({ sid: 'SM_template_bad' }),
      fetchStatus: async ({ sid }) =>
        sid === 'SM_template_bad' ? { status: 'undelivered' } : { status: 'sent' },
      sendPlain: async () => {
        plainCalls += 1;
        return { sid: 'SM_plain_after_template' };
      },
    }),
  });

  assert(plainCalls === 1, 'plain text attempted after template undelivered');
  assert(result.success === true, 'fallback plain text succeeds');
  assert(result.method === 'plain_text', 'final method is plain_text');
}

async function testWelcomeBodyMatchesTemplate(): Promise<void> {
  const body = buildImmediateWelcomeMessage('Roberto');
  assert(body.includes('¡Hola Roberto!'), 'name interpolated');
  assert(body.includes('1️⃣ Entra a app.kalyo.io/login'), 'steps included');
  assert(body.includes('¡Bienvenido/a! 🎉'), 'closing included');
}

async function runTests(): Promise<void> {
  console.log('Welcome message tests\n');

  await testTemplateNotApprovedFallsBackToPlainText();
  console.log('✓ template not approved → plain text fallback');

  await testNoTemplateUsesPlainTextDirectly();
  console.log('✓ no template → plain text directly');

  await testPlainTextUndeliveredReportsFailure();
  console.log('✓ plain text undelivered → failure reported');

  await testTemplateUndeliveredFallsBackToPlainText();
  console.log('✓ template undelivered → plain text fallback');

  await testWelcomeBodyMatchesTemplate();
  console.log('✓ welcome body matches template content');

  console.log('\nAll welcome message tests passed.');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
