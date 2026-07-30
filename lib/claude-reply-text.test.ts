import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FALLBACK_RESPONSE_ES,
  extractMeaningfulText,
  resolveReplyText,
} from './claude-reply-text';

describe('extractMeaningfulText', () => {
  it('returns text from a text block', () => {
    assert.equal(
      extractMeaningfulText([{ type: 'text', text: 'Hola' }]),
      'Hola',
    );
  });

  it('returns null for empty content', () => {
    assert.equal(extractMeaningfulText([]), null);
    assert.equal(extractMeaningfulText(undefined), null);
    assert.equal(extractMeaningfulText([{ type: 'tool_use' }]), null);
    assert.equal(extractMeaningfulText([{ type: 'text', text: '   ' }]), null);
  });
});

describe('resolveReplyText', () => {
  it('turno único sin tools → texto normal', () => {
    const result = resolveReplyText(
      [{ type: 'text', text: 'Respuesta normal' }],
      '',
    );
    assert.deepEqual(result, { text: 'Respuesta normal', source: 'final' });
  });

  it('tool_use + end_turn con texto → usa end_turn text', () => {
    const result = resolveReplyText(
      [{ type: 'text', text: 'Texto del end_turn' }],
      'Texto del tool_use turn',
    );
    assert.deepEqual(result, { text: 'Texto del end_turn', source: 'final' });
  });

  it('tool_use con texto útil + end_turn vacío → usa tool_use text', () => {
    const result = resolveReplyText(
      [],
      'Perfecto. Necesito tu nombre completo y email para crearte la cuenta.',
    );
    assert.deepEqual(result, {
      text: 'Perfecto. Necesito tu nombre completo y email para crearte la cuenta.',
      source: 'tool_use_turn',
    });
  });

  it('ambos turnos vacíos → fallback', () => {
    const result = resolveReplyText([], '');
    assert.deepEqual(result, {
      text: FALLBACK_RESPONSE_ES,
      source: 'fallback',
    });
  });

  it('end_turn con solo tool_use blocks y sin texto previo → fallback', () => {
    const result = resolveReplyText([{ type: 'tool_use' }], '   ');
    assert.equal(result.source, 'fallback');
    assert.equal(result.text, FALLBACK_RESPONSE_ES);
  });
});
