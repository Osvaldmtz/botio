import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildConversationMetadataForEnroll,
  buildGoogleAdsMetadata,
  bucketAdChannel,
  hasExistingAdAttribution,
  mergeAttributionMetadata,
  parseTwilioMetaReferral,
} from './ad-attribution';

describe('parseTwilioMetaReferral', () => {
  it('returns null when no referral params', () => {
    assert.equal(parseTwilioMetaReferral({ Body: 'Hola' }), null);
  });

  it('maps Meta Click-to-WhatsApp referral fields', () => {
    const result = parseTwilioMetaReferral({
      ReferralSourceId: '118588094077142',
      ReferralSourceType: 'ad',
      ReferralHeadline: 'Send us a message',
      ReferralBody: 'Learn more about Kalyo',
      ReferralCtwaClid: 'ctwa-abc123',
    });
    assert.ok(result);
    assert.equal(result!.source, 'meta_ads');
    assert.equal(result!.ad_channel, 'meta');
    assert.equal(result!.utm_source, 'facebook');
    assert.equal(result!.utm_medium, 'paid_social');
    assert.equal(result!.ad_campaign_id, '118588094077142');
    assert.equal(result!.ad_headline, 'Send us a message');
    assert.equal(result!.ad_referral_source_type, 'ad');
    assert.equal(result!.referral_ctwa_clid, 'ctwa-abc123');
  });
});

describe('buildGoogleAdsMetadata', () => {
  it('returns null without google signals', () => {
    assert.equal(buildGoogleAdsMetadata({ utm_source: 'newsletter' }), null);
  });

  it('builds metadata from gclid', () => {
    const result = buildGoogleAdsMetadata({
      gclid: 'CjwKCAiA',
      utm_campaign: 'brand_mx',
    });
    assert.ok(result);
    assert.equal(result!.source, 'google_ads');
    assert.equal(result!.ad_channel, 'google');
    assert.equal(result!.gclid, 'CjwKCAiA');
    assert.equal(result!.utm_campaign, 'brand_mx');
  });
});

describe('mergeAttributionMetadata', () => {
  it('does not overwrite existing ad attribution', () => {
    const existing = { source: 'meta_ads', ad_channel: 'meta', ad_campaign_id: '111' };
    const merged = mergeAttributionMetadata(existing, {
      source: 'google_ads',
      ad_channel: 'google',
    });
    assert.equal(merged.ad_channel, 'meta');
    assert.equal(merged.ad_campaign_id, '111');
  });

  it('applies patch when no prior attribution', () => {
    const merged = mergeAttributionMetadata({ customer_email: 'a@b.com' }, {
      source: 'google_ads',
      ad_channel: 'google',
      gclid: 'xyz',
    });
    assert.equal(merged.source, 'google_ads');
    assert.equal(merged.customer_email, 'a@b.com');
  });
});

describe('hasExistingAdAttribution', () => {
  it('detects meta and google', () => {
    assert.equal(hasExistingAdAttribution({ ad_channel: 'meta' }), true);
    assert.equal(hasExistingAdAttribution({ source: 'google_ads' }), true);
    assert.equal(hasExistingAdAttribution({ source: 'kalyo_web' }), false);
  });
});

describe('buildConversationMetadataForEnroll', () => {
  it('preserves meta attribution when enrolling trial', () => {
    const result = buildConversationMetadataForEnroll(
      { source: 'meta_ads', ad_channel: 'meta', ad_campaign_id: '111' },
      { email: 'a@b.com', name: 'Ana', source: 'kalyo_web' },
    );
    assert.equal(result.source, 'meta_ads');
    assert.equal(result.ad_channel, 'meta');
    assert.equal(result.customer_email, 'a@b.com');
  });

  it('applies google ads on enroll', () => {
    const result = buildConversationMetadataForEnroll(null, {
      email: 'a@b.com',
      name: 'Ana',
      source: 'kalyo_web',
      googleAds: { gclid: 'abc', utm_campaign: 'brand' },
    });
    assert.equal(result.source, 'google_ads');
    assert.equal(result.gclid, 'abc');
  });
});

describe('bucketAdChannel', () => {
  it('buckets metadata correctly', () => {
    assert.equal(bucketAdChannel({ ad_channel: 'meta' }), 'meta');
    assert.equal(bucketAdChannel({ source: 'google_ads' }), 'google');
    assert.equal(bucketAdChannel({ source: 'kalyo_web' }), 'web');
    assert.equal(bucketAdChannel(null), 'organic');
  });
});
