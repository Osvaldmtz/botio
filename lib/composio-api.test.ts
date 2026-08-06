import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { composioAuthHeaders, composioExecuteUrl, getComposioApiKey } from './composio-api';

describe('composio-api', () => {
  it('composioAuthHeaders uses x-api-key for REST API', () => {
    const headers = composioAuthHeaders('ak_test_key');
    assert.equal(headers['x-api-key'], 'ak_test_key');
    assert.equal(headers['Content-Type'], 'application/json');
    assert.equal('x-consumer-api-key' in headers, false);
  });

  it('composioExecuteUrl targets v3.1 backend', () => {
    assert.equal(
      composioExecuteUrl('GOOGLEADS_SEARCH_STREAM_GAQL'),
      'https://backend.composio.dev/api/v3.1/tools/execute/GOOGLEADS_SEARCH_STREAM_GAQL',
    );
  });

  it('getComposioApiKey rejects MCP consumer keys', () => {
    const prev = process.env.COMPOSIO_API_KEY;
    process.env.COMPOSIO_API_KEY = 'ck_5JCDh9pjkfY5A5N76Xug';
    try {
      assert.throws(() => getComposioApiKey(), /MCP consumer key/);
    } finally {
      process.env.COMPOSIO_API_KEY = prev;
    }
  });
});
