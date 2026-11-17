import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STAGE_RANK, normalizeStage } from '@/lib/pipeline';

/**
 * Mirrors setPipelineStageTrial gating without hitting Supabase.
 * Keep in sync with lib/pipeline-stage-mutations.ts.
 */
function shouldMoveToTrial(currentStage: string | null): boolean {
  const current = normalizeStage(currentStage);
  if (current === 'paid') return false;
  if (current === 'trial') return false;
  if (current !== 'lost' && STAGE_RANK.trial <= STAGE_RANK[current]) return false;
  return true;
}

describe('setPipelineStageTrial gating', () => {
  it('allows lost → trial (reopen after no-response)', () => {
    assert.equal(shouldMoveToTrial('lost'), true);
  });

  it('allows new/qualified → trial', () => {
    assert.equal(shouldMoveToTrial('new'), true);
    assert.equal(shouldMoveToTrial('qualified'), true);
  });

  it('blocks paid and already-trial', () => {
    assert.equal(shouldMoveToTrial('paid'), false);
    assert.equal(shouldMoveToTrial('trial'), false);
  });
});
