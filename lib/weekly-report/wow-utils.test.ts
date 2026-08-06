import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeWow, getPreviousWeeklyDateRange, getWeeklyDateRange } from './wow-utils';

describe('weekly-report wow-utils', () => {
  it('getWeeklyDateRange returns 7-day window ending yesterday', () => {
    const range = getWeeklyDateRange(7);
    const start = Date.parse(`${range.startDate}T00:00:00Z`);
    const end = Date.parse(`${range.endDate}T00:00:00Z`);
    const days = (end - start) / (24 * 60 * 60 * 1000);
    assert.equal(days, 6);
  });

  it('getPreviousWeeklyDateRange does not overlap current', () => {
    const current = getWeeklyDateRange(7);
    const previous = getPreviousWeeklyDateRange(7);
    assert.ok(previous.endDate < current.startDate);
  });

  it('computeWow calculates delta and pct', () => {
    const wow = computeWow(110, 100);
    assert.equal(wow.delta, 10);
    assert.equal(wow.delta_pct, 10);
  });

  it('computeWow handles zero previous', () => {
    const wow = computeWow(50, 0);
    assert.equal(wow.delta, 50);
    assert.equal(wow.delta_pct, null);
  });
});
