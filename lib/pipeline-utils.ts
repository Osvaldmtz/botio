import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  determineStage,
  type PipelineConversation,
  type PipelineMessage,
} from '@/lib/pipeline';
import { movePipelineStage } from '@/lib/pipeline-stage-mutations';

export {
  PIPELINE_STAGES,
  TERMINAL_STAGES,
  normalizeStage,
  determineStage,
  type PipelineStage,
} from '@/lib/pipeline';

export { movePipelineStage, setPipelineStageTrial } from '@/lib/pipeline-stage-mutations';

export async function clearManualPipelineOverride(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<void> {
  await supabase
    .from('conversations')
    .update({ pipeline_stage_updated_by: null })
    .eq('id', conversationId)
    .not('pipeline_stage_updated_by', 'is', null);
}

export async function maybeAutoAdvancePipeline(
  supabase: SupabaseClient,
  conversation: PipelineConversation,
  userMessageCount: number,
  messages?: PipelineMessage[],
): Promise<void> {
  if (conversation.pipeline_stage_updated_by) {
    return;
  }

  let msgs: PipelineMessage[] = messages ?? [];
  if (!messages) {
    const { data } = await supabase
      .from('messages')
      .select('role, content, metadata')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });
    msgs = (data ?? []) as PipelineMessage[];
  }

  const next = determineStage(conversation, msgs, userMessageCount);
  if (!next) return;

  await movePipelineStage(
    supabase,
    conversation.id,
    conversation.pipeline_stage,
    next,
    null,
    'auto',
  );
}
