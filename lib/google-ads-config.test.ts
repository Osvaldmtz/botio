import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getActiveCustomerId,
  getHistoricalCustomerId,
  getLoginCustomerIdForCustomer,
  getMetricsCustomerIds,
} from './google-ads-config';

describe('google-ads-config', () => {
  it('defaults active and historical customer ids from config/google-ads.json', () => {
    assert.equal(getActiveCustomerId(), '4732777525');
    assert.equal(getHistoricalCustomerId(), '4356627994');
  });

  it('returns both ids for rolling metrics', () => {
    assert.deepEqual(getMetricsCustomerIds(), ['4732777525', '4356627994']);
  });

  it('uses MCC login header only for the historical account', () => {
    assert.equal(getLoginCustomerIdForCustomer('4356627994'), '2224952854');
    assert.equal(getLoginCustomerIdForCustomer('4732777525'), null);
  });
});
