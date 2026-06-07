import type { PipelineStage } from '@/lib/pipeline';

export const STAGE_UI: Record<
  PipelineStage,
  { emoji: string; label: string }
> = {
  new: { emoji: '🆕', label: 'Nuevo' },
  in_conversation: { emoji: '💬', label: 'En conversación' },
  qualified: { emoji: '📧', label: 'Calificado' },
  trial: { emoji: '🎁', label: 'Trial' },
  paid: { emoji: '💰', label: 'Pagó' },
  lost: { emoji: '❌', label: 'Perdido' },
};
