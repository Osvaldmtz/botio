import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildConfirmationFailedAlert,
  combineDemoPhoneChecks,
  validateDemoPhoneFormat,
} from './demo-phone';

describe('demo phone validation', () => {
  it('rejects a Chilean number with a duplicated country code and asks for a correction', () => {
    const result = validateDemoPhoneFormat('+56 56 9713 73117');
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, 'invalid_chile');
    assert.match(result.message, /\+56 9 7137 3117/);
  });

  it('accepts a Chilean mobile and a Colombian number', () => {
    const chile = validateDemoPhoneFormat('+56912345678');
    assert.equal(chile.ok, true);
    const colombia = validateDemoPhoneFormat('+573001112233');
    assert.equal(colombia.ok, true);
  });

  it('rejects a number Twilio Lookup marks invalid', () => {
    const format = validateDemoPhoneFormat('+573001112233');
    const result = combineDemoPhoneChecks(format, { valid: false });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, 'lookup');
    assert.match(result.message, /no es válido/);
  });

  it('builds a Telegram alert when the confirmation send fails', () => {
    const text = buildConfirmationFailedAlert({
      name: 'Martiza Sepulveda',
      phone: '+5656971373117',
      email: 'maritzasr1987@gmail.com',
      when: '2026-10-01T20:30:00.000Z',
      reason: 'Twilio no aceptó el mensaje de confirmación',
    });
    assert.match(text, /NO enviada/);
    assert.match(text, /\+5656971373117/);
    assert.match(text, /confirmation_sent = false/);
    assert.match(text, /Twilio no aceptó/);
  });
});
