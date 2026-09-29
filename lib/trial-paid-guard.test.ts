import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterTrialFollowupRecipients,
  hasActivePaidSubscription,
  phoneLookupVariants,
} from './trial-paid-guard';

describe('hasActivePaidSubscription', () => {
  it('suppresses when subscription_status is active', () => {
    assert.equal(
      hasActivePaidSubscription({
        subscription_status: 'active',
        stripe_customer_id: 'cus_VJYcT5Ndunk7ST',
        stripe_subscription_id: 'sub_123',
      }),
      true,
    );
  });

  it('suppresses an active status even if stripe ids were not copied onto the row', () => {
    assert.equal(hasActivePaidSubscription({ subscription_status: 'Active' }), true);
  });

  it('does not treat a stripe customer id as active after the subscription ends', () => {
    assert.equal(
      hasActivePaidSubscription({
        subscription_status: 'canceled',
        stripe_customer_id: 'cus_old',
        stripe_subscription_id: 'sub_old',
      }),
      false,
    );
    assert.equal(
      hasActivePaidSubscription({
        subscription_status: null,
        stripe_customer_id: 'cus_no_sub',
      }),
      false,
    );
  });
});

describe('filterTrialFollowupRecipients', () => {
  it('drops paying psychologists and keeps trials without an active subscription', () => {
    const kept = filterTrialFollowupRecipients([
      { email: 'paid@kalyo.io', subscription_status: 'active', stripe_customer_id: 'cus_1' },
      { email: 'trial@kalyo.io', subscription_status: null, stripe_customer_id: null },
      { email: 'canceled@kalyo.io', subscription_status: 'canceled', stripe_customer_id: 'cus_2' },
    ]);

    assert.deepEqual(
      kept.map((row) => row.email),
      ['trial@kalyo.io', 'canceled@kalyo.io'],
    );
  });
});

describe('phoneLookupVariants', () => {
  it('matches the same WhatsApp stored with or without the whatsapp prefix', () => {
    const variants = phoneLookupVariants('whatsapp:+525573490179');
    assert.ok(variants.includes('+525573490179'));
    assert.ok(variants.includes('whatsapp:+525573490179'));
    assert.ok(variants.includes('525573490179'));
  });
});
