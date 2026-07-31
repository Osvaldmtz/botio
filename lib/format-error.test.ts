import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatUnknownError } from './format-error';

describe('formatUnknownError', () => {
  it('returns Error.message', () => {
    assert.equal(formatUnknownError(new Error('boom')), 'boom');
  });

  it('stringifies nested composio-style errors instead of [object Object]', () => {
    const err = { error: { code: 429, message: 'Resource has been exhausted' } };
    const formatted = formatUnknownError(err);
    assert.notEqual(formatted, '[object Object]');
    assert.match(formatted, /429|exhausted/);
  });

  it('handles string errors', () => {
    assert.equal(formatUnknownError('plain'), 'plain');
  });
});
