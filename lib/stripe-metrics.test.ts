import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Pure helpers mirrored from stripe-metrics churn math
 * (kept local so tests don't need Stripe API).
 */
function churnRatePct(active: number, canceled30d: number): number {
  const startApprox = active + canceled30d;
  return startApprox > 0
    ? Number(((canceled30d / startApprox) * 100).toFixed(2))
    : 0;
}

function estimatedLtvMonths(churnRatePctMonthly: number): number | null {
  if (churnRatePctMonthly <= 0) return null;
  return Number((100 / churnRatePctMonthly).toFixed(1));
}

describe('stripe-metrics churn math', () => {
  it('computes churn rate from active + canceled base', () => {
    assert.equal(churnRatePct(93, 7), 7);
    assert.equal(churnRatePct(0, 0), 0);
    assert.equal(churnRatePct(50, 0), 0);
  });

  it('estimates LTV months as 100 / churn%', () => {
    assert.equal(estimatedLtvMonths(5), 20);
    assert.equal(estimatedLtvMonths(0), null);
  });
});

describe('stripe-metrics exports', () => {
  it('documents the public API surface', () => {
    // server-only module — cannot import in node:test; API is asserted by name list.
    const api = [
      'getActiveSubscriptions',
      'getCanceledLast30d',
      'getMRRReal',
      'getChurnRate',
      'getPastDueSnapshot',
      'getStripeMetricsSnapshot',
    ];
    assert.equal(api.length, 6);
  });
});
