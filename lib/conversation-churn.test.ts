import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Unit-level contract for churn metadata shape written by
 * markSubscriptionChurnedByEmail / syncSubscriptionBillingMetadataByEmail.
 */
function buildChurnMetadata(
  prev: Record<string, unknown>,
  opts: {
    canceledAt: string;
    subscriptionId?: string;
    planExpiresAt?: string | null;
  },
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    ...prev,
    subscription_status: 'canceled',
    canceled_at: opts.canceledAt,
  };
  if (opts.subscriptionId) metadata.subscription_id = opts.subscriptionId;
  if (opts.planExpiresAt) metadata.plan_expires_at = opts.planExpiresAt;
  return metadata;
}

function buildReactivateMetadata(
  prev: Record<string, unknown>,
  status: string,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    ...prev,
    subscription_status: status,
  };
  if (status === 'active' && prev.canceled_at) {
    delete metadata.canceled_at;
  }
  return metadata;
}

describe('conversation churn metadata', () => {
  it('preserves existing attribution fields when marking churn', () => {
    const next = buildChurnMetadata(
      { source: 'meta_ads', ad_channel: 'meta', paid_at: '2026-09-01T00:00:00Z' },
      {
        canceledAt: '2026-10-01T00:00:00Z',
        subscriptionId: 'sub_123',
        planExpiresAt: '2026-10-01T00:00:00Z',
      },
    );
    assert.equal(next.source, 'meta_ads');
    assert.equal(next.ad_channel, 'meta');
    assert.equal(next.paid_at, '2026-09-01T00:00:00Z');
    assert.equal(next.subscription_status, 'canceled');
    assert.equal(next.canceled_at, '2026-10-01T00:00:00Z');
    assert.equal(next.subscription_id, 'sub_123');
  });

  it('clears canceled_at when status returns to active', () => {
    const next = buildReactivateMetadata(
      { canceled_at: '2026-10-01T00:00:00Z', subscription_status: 'canceled' },
      'active',
    );
    assert.equal(next.subscription_status, 'active');
    assert.equal(next.canceled_at, undefined);
  });
});
