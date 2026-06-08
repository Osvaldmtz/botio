export const CLOSURE_REASONS = [
  'price',
  'thinking',
  'competition',
  'no_time',
  'not_useful',
  'no_response',
  'converted',
  'other',
] as const;

export type ClosureReason = (typeof CLOSURE_REASONS)[number];

export const CLOSURE_REASON_UI: Record<
  ClosureReason,
  { emoji: string; label: string; description: string }
> = {
  price: {
    emoji: '💰',
    label: 'Precio',
    description: 'Lead consideró el precio muy alto',
  },
  thinking: {
    emoji: '🤔',
    label: 'Lo va a pensar',
    description: 'Lead pidió tiempo y no volvió',
  },
  competition: {
    emoji: '⚔️',
    label: 'Competencia',
    description: 'Lead usa otro sistema y no quiere cambiar',
  },
  no_time: {
    emoji: '⏰',
    label: 'Sin tiempo',
    description: 'Lead no tiene tiempo para evaluar',
  },
  not_useful: {
    emoji: '🚫',
    label: 'No le sirve',
    description: 'Kalyo no aplica a su necesidad',
  },
  no_response: {
    emoji: '👻',
    label: 'No responde',
    description: 'Lead dejó de responder mensajes',
  },
  converted: {
    emoji: '✅',
    label: 'Convertido',
    description: 'Lead pagó / activó plan',
  },
  other: {
    emoji: '📝',
    label: 'Otro',
    description: 'Razón libre con texto',
  },
};

export function isClosureReason(value: string): value is ClosureReason {
  return (CLOSURE_REASONS as readonly string[]).includes(value);
}

export function formatClosureLabel(reason: ClosureReason): string {
  const ui = CLOSURE_REASON_UI[reason];
  return `${ui.emoji} ${ui.label}`;
}
