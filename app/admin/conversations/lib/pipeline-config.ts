import type { PipelineStage } from '@/lib/pipeline';

export const STAGE_UI: Record<
  PipelineStage,
  { emoji: string; label: string; headerClass: string; columnClass: string }
> = {
  new: {
    emoji: '🆕',
    label: 'Nuevo',
    headerClass: 'text-blue-300 border-blue-500/40 bg-blue-500/10',
    columnClass: 'border-blue-500/20 bg-blue-500/5',
  },
  in_conversation: {
    emoji: '💬',
    label: 'En conversación',
    headerClass: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
    columnClass: 'border-cyan-500/20 bg-cyan-500/5',
  },
  qualified: {
    emoji: '📧',
    label: 'Calificado',
    headerClass: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
    columnClass: 'border-amber-500/20 bg-amber-500/5',
  },
  trial: {
    emoji: '🎁',
    label: 'Trial',
    headerClass: 'text-orange-300 border-orange-500/40 bg-orange-500/10',
    columnClass: 'border-orange-500/20 bg-orange-500/5',
  },
  paid: {
    emoji: '💰',
    label: 'Pagó',
    headerClass: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
    columnClass: 'border-emerald-500/20 bg-emerald-500/5',
  },
  lost: {
    emoji: '❌',
    label: 'Perdido',
    headerClass: 'text-zinc-400 border-zinc-500/40 bg-zinc-500/10',
    columnClass: 'border-zinc-500/20 bg-zinc-500/5',
  },
};
