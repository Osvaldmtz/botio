import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatGoogleAdsApiError,
  parseGoogleAdsHttpBody,
  shouldFallbackToComposio,
} from './google-ads-http';

describe('parseGoogleAdsHttpBody', () => {
  it('parses JSON responses', () => {
    const result = parseGoogleAdsHttpBody(200, 'application/json', '{"results":[]}');
    assert.deepEqual(result, { results: [] });
  });

  it('throws readable error for HTML 404', () => {
    assert.throws(
      () =>
        parseGoogleAdsHttpBody(
          404,
          'text/html; charset=UTF-8',
          '<!DOCTYPE html><html><title>Error 404</title></html>',
        ),
      (err: Error) => {
        assert.match(err.message, /endpoint not found|HTML/i);
        return true;
      },
    );
  });

  it('throws rate limit message for 429 JSON', () => {
    assert.throws(
      () =>
        parseGoogleAdsHttpBody(
          429,
          'application/json',
          JSON.stringify({
            error: {
              code: 429,
              message: 'Resource has been exhausted (e.g. check quota).',
              status: 'RESOURCE_EXHAUSTED',
              details: [
                {
                  '@type': 'type.googleapis.com/google.ads.googleads.v25.errors.GoogleAdsFailure',
                  errors: [
                    {
                      message: 'Too many requests. Retry in 120 seconds.',
                      details: { quotaErrorDetails: { retryDelay: '120s' } },
                    },
                  ],
                },
              ],
            },
          }),
        ),
      (err: Error) => {
        assert.match(err.message, /Rate limit/i);
        assert.match(err.message, /2 min/i);
        return true;
      },
    );
  });
});

describe('shouldFallbackToComposio', () => {
  it('returns true for rate limit and HTML errors', () => {
    assert.equal(shouldFallbackToComposio(new Error('Google Ads rate limit — reintentar en 5 min')), true);
    assert.equal(
      shouldFallbackToComposio(new Error('Google Ads API returned HTML instead of JSON (HTTP 404)')),
      true,
    );
  });

  it('returns false for missing config errors', () => {
    assert.equal(shouldFallbackToComposio(new Error('Missing COMPOSIO_API_KEY')), false);
  });
});

describe('formatGoogleAdsApiError', () => {
  it('unwraps JSON parse failures into readable message', () => {
    const msg = formatGoogleAdsApiError(
      new SyntaxError("Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"),
    );
    assert.match(msg, /HTML|JSON/i);
  });
});
