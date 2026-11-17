import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCompMetadata,
  filterActionablePastDue,
  isCompedSubscription,
  summarizeSubscriberCounts,
} from './stripe-comp';

describe('isCompedSubscription', () => {
  it('returns true when metadata.comp is the string true', () => {
    assert.equal(isCompedSubscription({ metadata: { comp: 'true' } }), true);
  });

  it('returns false when metadata.comp is missing or not true', () => {
    assert.equal(isCompedSubscription({ metadata: {} }), false);
    assert.equal(isCompedSubscription({ metadata: { comp: 'false' } }), false);
    assert.equal(isCompedSubscription({}), false);
  });
});

describe('filterActionablePastDue', () => {
  it('excludes subscriptions with metadata.comp = true', () => {
    const subs = [
      { id: 'sub_real', metadata: {} },
      { id: 'sub_comp', metadata: { comp: 'true', comp_reason: 'contenido generado' } },
      { id: 'sub_other', metadata: { comp: 'yes' } },
    ];
    const filtered = filterActionablePastDue(subs);
    assert.deepEqual(
      filtered.map((s) => s.id),
      ['sub_real', 'sub_other'],
    );
  });
});

describe('buildCompMetadata', () => {
  it('builds required courtesy metadata', () => {
    const at = '2026-10-02T22:00:00.000Z';
    assert.deepEqual(
      buildCompMetadata({
        reason: 'contenido generado',
        by: 'osvaldo',
        at,
      }),
      {
        comp: 'true',
        comp_reason: 'contenido generado',
        compd_by: 'osvaldo',
        compd_at: at,
      },
    );
  });
});

describe('summarizeSubscriberCounts', () => {
  it('counts active and past_due comps as active, labeling comps separately', () => {
    const summary = summarizeSubscriberCounts([
      { id: 'a', status: 'active', metadata: {} },
      { id: 'b', status: 'active', metadata: { comp: 'true' } },
      { id: 'c', status: 'past_due', metadata: { comp: 'true' } },
      { id: 'd', status: 'past_due', metadata: {} },
      { id: 'e', status: 'canceled', metadata: { comp: 'true' } },
    ]);
    assert.deepEqual(summary, {
      active_total: 3,
      active_paying: 1,
      active_comped: 2,
      past_due_actionable: 1,
    });
  });
});
