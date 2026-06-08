import type { ClosureReason } from '@/lib/conversation-closure-constants';
import type { PipelineStage } from '@/lib/pipeline';

/** Pipeline uses `paid` as the converted terminal stage. */
export const CONVERTED_PIPELINE_STAGE: PipelineStage = 'paid';

export function resolvePipelineStageOnClosure(
  reason: ClosureReason,
): PipelineStage | null {
  if (reason === 'converted') return CONVERTED_PIPELINE_STAGE;
  if (reason === 'no_response' || reason === 'not_useful') return 'lost';
  return null;
}

export function isAdminClosedConversation(conv: {
  closure_reason?: string | null;
}): boolean {
  return Boolean(conv.closure_reason);
}
