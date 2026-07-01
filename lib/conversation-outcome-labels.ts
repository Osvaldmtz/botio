export const CONVERSATION_OUTCOMES = [
  'paid',
  'trial_activated',
  'lost_no_response',
  'lost_objection',
  'lost_competitor',
  'lost_price',
  'unsubscribed',
] as const;

export type ConversationOutcome = (typeof CONVERSATION_OUTCOMES)[number];

export type OutcomeSource =
  | 'stripe_webhook'
  | 'trial_enroll'
  | 'cron_30days'
  | 'admin_manual'
  | string;

const OUTCOME_LABELS: Record<ConversationOutcome, string> = {
  paid: 'Pagó suscripción',
  trial_activated: 'Trial activado',
  lost_no_response: 'Sin respuesta (30d)',
  lost_objection: 'Objeción no superada',
  lost_competitor: 'Eligió competencia',
  lost_price: 'Precio barrera',
  unsubscribed: 'Pidió no contacto',
};

export function isConversationOutcome(value: string): value is ConversationOutcome {
  return (CONVERSATION_OUTCOMES as readonly string[]).includes(value);
}

export function outcomeLabel(outcome: string | null | undefined): string {
  if (!outcome) return 'Sin marcar';
  if (isConversationOutcome(outcome)) return OUTCOME_LABELS[outcome];
  return outcome;
}
