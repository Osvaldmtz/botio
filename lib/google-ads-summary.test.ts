import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregateGoogleAdsTotals,
  buildGoogleAdsSummary,
  buildGoogleCampaignSummaryRows,
  computeGoogleCpa,
} from './google-ads-summary';

describe('computeGoogleCpa', () => {
  it('returns null when no conversions', () => {
    assert.equal(computeGoogleCpa(100, 0), null);
  });

  it('divides spend by conversions', () => {
    assert.equal(computeGoogleCpa(150, 3), 50);
  });
});

describe('buildGoogleCampaignSummaryRows', () => {
  it('aggregates daily rows by campaign', () => {
    const rows = buildGoogleCampaignSummaryRows([
      {
        campaign_id: '1',
        campaign_name: 'Search Brand',
        status: 'ENABLED',
        spend: 100,
        impressions: 1000,
        clicks: 50,
        conversions: 2,
      },
      {
        campaign_id: '1',
        campaign_name: 'Search Brand',
        status: 'ENABLED',
        spend: 50,
        impressions: 500,
        clicks: 25,
        conversions: 1,
      },
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].spend, 150);
    assert.equal(rows[0].impressions, 1500);
    assert.equal(rows[0].clicks, 75);
    assert.equal(rows[0].conversions, 3);
    assert.equal(rows[0].cpa, 50);
    assert.equal(rows[0].ctr, 5);
  });
});

describe('buildGoogleAdsSummary', () => {
  it('aggregates account totals', () => {
    const summary = buildGoogleAdsSummary(
      [
        {
          campaign_id: '1',
          campaign_name: 'A',
          status: 'ENABLED',
          spend: 100,
          impressions: 1000,
          clicks: 10,
          conversions: 2,
        },
        {
          campaign_id: '2',
          campaign_name: 'B',
          status: 'PAUSED',
          spend: 50,
          impressions: 500,
          clicks: 5,
          conversions: 1,
        },
      ],
      '2026-07-30T00:00:00.000Z',
      true,
    );

    assert.equal(summary.totals.spend, 150);
    assert.equal(summary.totals.conversions, 3);
    assert.equal(summary.totals.cpa, 50);
    assert.equal(summary.totals.ctr, 1);
    assert.equal(summary.configured, true);
    assert.equal(summary.currency, 'COP');
  });
});

describe('aggregateGoogleAdsTotals', () => {
  it('handles empty campaigns', () => {
    const totals = aggregateGoogleAdsTotals([]);
    assert.deepEqual(totals, {
      spend: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      conversions: 0,
      cpa: null,
    });
  });
});
