import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeWhatsAppAddress,
  splitWhatsAppBody,
  WHATSAPP_BODY_PART_LIMIT,
} from './whatsapp-outbound';

describe('normalizeWhatsAppAddress', () => {
  it('strips internal spaces and keeps the whatsapp prefix', () => {
    assert.equal(normalizeWhatsAppAddress('whatsapp:+593 996001411'), 'whatsapp:+593996001411');
  });

  it('adds the whatsapp prefix to a bare E.164 number', () => {
    assert.equal(normalizeWhatsAppAddress('+524432072992'), 'whatsapp:+524432072992');
  });
});

describe('splitWhatsAppBody', () => {
  it('leaves messages within the limit unchanged', () => {
    const text = 'Hola, ¿cómo estás?';
    assert.deepEqual(splitWhatsAppBody(text), [text]);
    assert.deepEqual(splitWhatsAppBody('a'.repeat(WHATSAPP_BODY_PART_LIMIT)), [
      'a'.repeat(WHATSAPP_BODY_PART_LIMIT),
    ]);
  });

  it('splits on a paragraph before cutting a word', () => {
    const intro = 'palabra '.repeat(140).trimEnd();
    const rest = `${'otra '.repeat(200)}fin.`;
    const parts = splitWhatsAppBody(`${intro}\n\n${rest}`);
    assert.ok(parts.length >= 2);
    assert.equal(parts[0], intro);
    assert.ok(parts.slice(1).join(' ').endsWith('fin.'));
    for (const part of parts) {
      assert.ok(part.length <= WHATSAPP_BODY_PART_LIMIT);
      assert.equal(part, part.trim());
    }
  });

  it('splits a long reply at a sentence and never mid-word', () => {
    const sentence = 'Kalyo automatiza la documentación clínica del psicólogo. ';
    const text = sentence.repeat(40).trim();
    assert.ok(text.length > WHATSAPP_BODY_PART_LIMIT);
    const parts = splitWhatsAppBody(text);
    assert.ok(parts.length >= 2);
    for (const part of parts) {
      assert.ok(part.length <= WHATSAPP_BODY_PART_LIMIT);
      assert.ok(!part.endsWith('documentaci'));
      assert.match(part, /[.!?…]$/);
    }
    assert.equal(parts.join(' '), text);
  });

  it('falls back to the last space when there is no sentence break', () => {
    const text = `${'a'.repeat(1490)} palabra-larga-que-no-se-corta extra`;
    const parts = splitWhatsAppBody(text);
    assert.deepEqual(parts[0], 'a'.repeat(1490));
    assert.equal(parts[1]?.startsWith('palabra-larga'), true);
    assert.ok(parts.every((part) => part.length <= WHATSAPP_BODY_PART_LIMIT));
  });
});
