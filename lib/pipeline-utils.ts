import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  STAGE_RANK,
  determineStage,
  normalizeStage,
  type PipelineConversation,
  type PipelineMessage,
  type PipelineStage,
} from '@/lib/pipeline';

export {
  PIPELINE_STAGES,
  TERMINAL_STAGES,
  normalizeStage,
  determineStage,
  type PipelineStage,
} from '@/lib/pipeline';

export async function movePipelineStage(
  supabase: SupabaseClient,
  conversationId: string,
  fromStage: PipelineStage | string | null,
  toStage: PipelineStage,
  movedBy: string | null,
  reason: 'auto' | 'manual' | 'cron',
): Promise<boolean> {
  const now = new Date().toISOString();
  const normalizedFrom = fromStage ? normalizeStage(String(fromStage)) : null;

  if (normalizedFrom === toStage) return false;

  const { error: updateError } = await supabase
    .from('conversations')
    .update({
      pipeline_stage: toStage,
      pipeline_stage_updated_at: now,
      pipeline_stage_updated_by: movedBy,
    })
    .eq('id', conversationId);

  if (updateError) throw updateError;

  const { error: historyError } = await supabase.from('pipeline_stage_history').insert({
    conversation_id: conversationId,
    from_stage: normalizedFrom,
    to_stage: toStage,
    moved_by: movedBy,
    reason,
  });

  if (historyError) throw historyError;

  const logTag = reason === 'manual' ? 'manual move' : 'auto-stage';
  console.log(
    `[pipeline] ${logTag} | conv=${conversationId} | from=${normalizedFrom ?? '—'} | to=${toStage}${movedBy ? ` | by=${movedBy}` : ''}${reason === 'cron' ? ' | reason=cron' : reason === 'auto' ? ' | reason=auto' : ''}`,
  );

  return true;
}

export async function maybeAutoAdvancePipeline(
  supabase: SupabaseClient,
  conversation: PipelineConversation,
  userMessageCount: number,
  messages?: PipelineMessage[],
): Promise<void> {
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

export async function setPipelineStageTrial(
  supabase: SupabaseClient,
  conversationId: string,
  currentStage: string | null,
): Promise<void> {
  const current = normalizeStage(currentStage);
  if (current === 'paid' || current === 'lost') return;
  if (STAGE_RANK.trial <= STAGE_RANK[current]) return;

  await movePipelineStage(supabase, conversationId, current, 'trial', null, 'auto');
}
