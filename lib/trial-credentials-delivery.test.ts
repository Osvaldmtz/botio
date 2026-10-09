import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatWelcomeAccessWithoutTempPassword,
  formatWhatsAppTempPasswordBlock,
  generateKalyoPassword,
  isKalyoTempPasswordFormat,
} from './kalyo-password';
import { formatDay1Welcome } from './trial-onboarding-messages';
import { buildTrialTempPasswordWelcomeText } from './trial-credentials-welcome-text';

describe('trial credentials welcome (activation → password in message)', () => {
  it('includes the exact Auth password in the welcome body', () => {
    const tempPassword = generateKalyoPassword(new Date('2026-10-09T12:00:00Z'));
    assert.equal(isKalyoTempPasswordFormat(tempPassword), true);

    const body = buildTrialTempPasswordWelcomeText({
      name: 'Ana Prueba',
      email: 'ana.prueba@kalyo.test',
      trialEndsAt: '2026-10-16T12:00:00.000Z',
      tempPassword,
      trialPlan: 'max',
    });

    assert.ok(body.includes(tempPassword), 'welcome must contain Auth password');
    assert.ok(
      body.includes(`\n${tempPassword}\n`),
      'password must be on its own line for WhatsApp copy',
    );
    assert.ok(
      body.includes('Cópiala tal cual') || body.includes('cópiala tal cual'),
      'must use WhatsApp copy instruction block',
    );
    assert.ok(
      body.includes(formatWhatsAppTempPasswordBlock(tempPassword).split('\n')[1]!),
      'password line from formatWhatsAppTempPasswordBlock must be present',
    );
    assert.equal(body.includes('revisa el mensaje anterior'), false);
    assert.ok(body.includes('ana.prueba@kalyo.test'));
    assert.ok(body.includes('app.kalyo.io/login'));
  });

  it('rejects empty tempPassword', () => {
    assert.throws(
      () =>
        buildTrialTempPasswordWelcomeText({
          name: 'Ana',
          email: 'ana@test.com',
          trialEndsAt: '2026-10-16T12:00:00.000Z',
          tempPassword: '   ',
        }),
      /tempPassword is required/,
    );
  });
});

describe('welcome without temp password', () => {
  it('never tells the user to review a previous message', () => {
    const fallback = formatWelcomeAccessWithoutTempPassword();
    assert.equal(fallback.includes('revisa el mensaje anterior'), false);
    assert.ok(
      fallback.includes('contraseña que elegiste') ||
        fallback.includes('Continuar con Google'),
    );

    const day1 = formatDay1Welcome({
      trial_user_name: 'María',
      trial_user_email: 'maria@test.com',
      trialEndsAt: '2026-10-16T12:00:00.000Z',
      email: 'maria@test.com',
    });
    assert.equal(day1.includes('revisa el mensaje anterior'), false);
    assert.ok(
      day1.includes('Continuar con Google') || day1.includes('contraseña que elegiste'),
    );
  });
});
