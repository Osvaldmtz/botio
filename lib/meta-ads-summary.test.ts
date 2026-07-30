import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregateMetaAdsTotals,
  buildCampaignSummaryRows,
  buildMetaAdsSummary,
  computeCpa,
  extractMessagingConversations,
  MESSAGING_CONVERSATION_ACTION,
} from './meta-ads-summary';

describe('extractMessagingConversations', () => {
  it('returns 0 when actions missing', () => {
    assert.equal(extractMessagingConversations(undefined), 0);
    assert.equal(extractMessagingConversations([]), 0);
  });

  it('extracts messaging_conversation_started_7d', () => {
    assert.equal(
      extractMessagingConversations([
        { action_type: 'link_click', value: '10' },
        { action_type: MESSAGING_CONVERSATION_ACTION, value: '7' },
      ]),
      7,
    );
  });
});

describe('computeCpa', () => {
  it('returns null when no conversations', () => {
    assert.equal(computeCpa(100, 0), null);
  });

  it('divides spend by conversations', () => {
    assert.equal(computeCpa(150, 3), 50);
  });
});

describe('buildCampaignSummaryRows', () => {
  it('merges status and computes conversations + cpa', () => {
    const rows = buildCampaignSummaryRows(
      [
        {
          campaign_id: '1',
          campaign_name: 'WA Leads',
          spend: '300',
          impressions: '1000',
          clicks: '50',
          ctr: '5',
          cpc: '6',
          cpm: '300',
          reach: '800',
          actions: [{ action_type: MESSAGING_CONVERSATION_ACTION, value: '6' }],
        },
      ],
      [{ id: '1', name: 'WA Leads', effective_status: 'ACTIVE' }],
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0].effective_status, 'ACTIVE');
    assert.equal(rows[0].conversations, 6);
    assert.equal(rows[0].cpa, 50);
  });

  it('includes ACTIVE campaigns with no insights', () => {
    const rows = buildCampaignSummaryRows(
      [],
      [{ id: '2', name: 'Paused? No', effective_status: 'ACTIVE' }],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].campaign_id, '2');
    assert.equal(rows[0].spend, 0);
    assert.equal(rows[0].cpa, null);
  });
});

describe('buildMetaAdsSummary', () => {
  it('aggregates account totals', () => {
    const summary = buildMetaAdsSummary(
      [
        {
          campaign_id: '1',
          campaign_name: 'A',
          spend: '100',
          impressions: '1000',
          clicks: '10',
          reach: '500',
          actions: [{ action_type: MESSAGING_CONVERSATION_ACTION, value: '2' }],
        },
        {
          campaign_id: '2',
          campaign_name: 'B',
          spend: '50',
          impressions: '500',
          clicks: '5',
          reach: '200',
          actions: [{ action_type: MESSAGING_CONVERSATION_ACTION, value: '1' }],
        },
      ],
      [
        { id: '1', effective_status: 'ACTIVE' },
        { id: '2', effective_status: 'PAUSED' },
      ],
      '2026-07-30T00:00:00.000Z',
    );

    assert.equal(summary.totals.spend, 150);
    assert.equal(summary.totals.conversations, 3);
    assert.equal(summary.totals.cpa, 50);
    assert.equal(summary.totals.ctr, 1);
    assert.equal(summary.currency, 'MXN');
    assert.equal(summary.period, 'last_30d');
  });
});

describe('aggregateMetaAdsTotals', () => {
  it('handles empty campaigns', () => {
    const totals = aggregateMetaAdsTotals([]);
    assert.deepEqual(totals, {
      spend: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      reach: 0,
      conversations: 0,
      cpa: null,
    });
  });
});
