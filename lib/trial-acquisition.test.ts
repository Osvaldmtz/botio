import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DIRECT_UNKNOWN_CHANNEL,
  aggregateTrialsByChannel,
  formatAcquisitionChannel,
} from './trial-acquisition-utils';

describe('formatAcquisitionChannel', () => {
  it('returns directo / desconocido when attribution is null', () => {
    assert.equal(formatAcquisitionChannel(null), DIRECT_UNKNOWN_CHANNEL);
  });

  it('formats utm_source and utm_medium', () => {
    assert.equal(
      formatAcquisitionChannel({ utm_source: 'google', utm_medium: 'cpc' }),
      'google / cpc',
    );
    assert.equal(
      formatAcquisitionChannel({ utm_source: 'Google', utm_medium: 'organic' }),
      'google / organic',
    );
  });

  it('uses defaults for partial attribution', () => {
    assert.equal(formatAcquisitionChannel({ utm_source: 'google' }), 'google / desconocido');
    assert.equal(formatAcquisitionChannel({ utm_medium: 'cpc' }), 'directo / cpc');
  });

  it('treats empty attribution object as directo / desconocido', () => {
    assert.equal(formatAcquisitionChannel({}), DIRECT_UNKNOWN_CHANNEL);
  });
});

describe('aggregateTrialsByChannel', () => {
  it('groups trials and computes percentages', () => {
    const rows = aggregateTrialsByChannel([
      { attribution: { utm_source: 'google', utm_medium: 'cpc' }, created_at: '2026-01-01' },
      { attribution: { utm_source: 'google', utm_medium: 'cpc' }, created_at: '2026-01-02' },
      { attribution: null, created_at: '2026-01-03' },
    ]);

    assert.deepEqual(rows, [
      { channel: 'google / cpc', trials: 2, pct: 66.7 },
      { channel: DIRECT_UNKNOWN_CHANNEL, trials: 1, pct: 33.3 },
    ]);
  });
});
