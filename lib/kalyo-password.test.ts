import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatWhatsAppTempPasswordBlock,
  generateKalyoPassword,
  isKalyoTempPasswordFormat,
} from './kalyo-password';

describe('generateKalyoPassword', () => {
  it('has no hyphens and matches Kalyo{year}{4}', () => {
    const password = generateKalyoPassword(new Date('2026-09-02T00:00:00Z'));
    assert.equal(password.includes('-'), false);
    assert.match(password, /^Kalyo2026[A-HJ-NP-Z2-9]{4}$/);
    assert.equal(isKalyoTempPasswordFormat(password), true);
  });

  it('never uses ambiguous I O 0 1', () => {
    for (let i = 0; i < 40; i++) {
      const password = generateKalyoPassword();
      assert.equal(/[IO01]/.test(password.slice('Kalyo2026'.length)), false);
    }
  });
});

describe('formatWhatsAppTempPasswordBlock', () => {
  it('puts the password on its own line', () => {
    const block = formatWhatsAppTempPasswordBlock('Kalyo2026CV7S');
    assert.ok(block.includes('\nKalyo2026CV7S\n'));
    assert.equal(block.includes('Kalyo-'), false);
  });
});
