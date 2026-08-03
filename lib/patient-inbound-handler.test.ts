import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPhoneLookupSuffix,
  buildPhoneLookupSuffixes,
  formatPatientAck,
  formatPsychologistNotification,
  phonesEquivalent,
} from './patient-inbound-utils';

describe('phonesEquivalent', () => {
  it('matches identical E.164 numbers', () => {
    assert.equal(phonesEquivalent('+525584736714', '+525584736714'), true);
  });

  it('matches numbers with different formatting', () => {
    assert.equal(phonesEquivalent('+525584736714', '+52 55 84736714'), true);
    assert.equal(phonesEquivalent('+525584736714', '(55) 8473-6714'), true);
    assert.equal(phonesEquivalent('+525584736714', '5584736714'), true);
  });

  it('matches old Mexican Twilio +521 format', () => {
    assert.equal(phonesEquivalent('+5215584736714', '+525584736714'), true);
  });

  it('does not match different numbers', () => {
    assert.equal(phonesEquivalent('+525584736714', '+525584736715'), false);
  });
});

describe('buildPhoneLookupSuffixes', () => {
  it('returns suffixes from longest to shortest', () => {
    assert.deepEqual(buildPhoneLookupSuffixes('+525584736714'), [
      '5584736714',
      '4736714',
      '736714',
      '36714',
      '6714',
    ]);
  });

  it('returns null-equivalent empty list for too-short numbers', () => {
    assert.deepEqual(buildPhoneLookupSuffixes('123'), []);
  });
});

describe('buildPhoneLookupSuffix', () => {
  it('returns last 10 digits for long numbers', () => {
    assert.equal(buildPhoneLookupSuffix('+525584736714'), '5584736714');
  });

  it('returns null for too-short numbers', () => {
    assert.equal(buildPhoneLookupSuffix('123'), null);
  });
});

describe('message templates', () => {
  it('formats psychologist notification', () => {
    const msg = formatPsychologistNotification('Ana', 'Hola doctor', '+525511111111');
    assert.match(msg, /Tu paciente Ana te escribió/);
    assert.match(msg, /'Hola doctor'/);
    assert.match(msg, /\+525511111111/);
  });

  it('formats patient acknowledgment', () => {
    assert.equal(
      formatPatientAck('Ana'),
      'Hola Ana, tu mensaje fue enviado a tu psicólogo. En breve te contactará directamente. 😊',
    );
  });
});
