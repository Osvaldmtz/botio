import type { ChatMessage } from '@/lib/claude';

export const HAIKU_MODEL = 'claude-haiku-4-5';
export const SONNET_MODEL = 'claude-sonnet-4-6';

export type ModelSelection = {
  model: string;
  reason: string;
  complexity: 'low' | 'high';
};

const PRICE_OBJECTION_RE =
  /muy caro|carisimo|fuera de mi presupuesto|no puedo pagar|necesito descuento/i;
const TECHNICAL_RE = /api|integracion|webhook|exportar|backup|migrar|cifrado|seguridad/i;
const COMPETITOR_RE = /heiko|assessmentmind|psiris|elo/i;
const DOUBT_RE = /no estoy seguro|me lo pienso|tengo que pensarlo|dejame consultar/i;

function countUserMessages(history: ChatMessage[]): number {
  return history.filter((m) => m.role === 'user').length;
}

export function selectModel(
  userMessage: string,
  conversationContext: ChatMessage[],
): ModelSelection {
  if (userMessage.length > 200) {
    return {
      model: SONNET_MODEL,
      reason: 'message length > 200 characters',
      complexity: 'high',
    };
  }

  if (PRICE_OBJECTION_RE.test(userMessage)) {
    return {
      model: SONNET_MODEL,
      reason: 'strong price objection',
      complexity: 'high',
    };
  }

  if (TECHNICAL_RE.test(userMessage)) {
    return {
      model: SONNET_MODEL,
      reason: 'technical question',
      complexity: 'high',
    };
  }

  if (countUserMessages(conversationContext) > 10) {
    return {
      model: SONNET_MODEL,
      reason: 'long conversation (>10 user messages)',
      complexity: 'high',
    };
  }

  if (COMPETITOR_RE.test(userMessage)) {
    return {
      model: SONNET_MODEL,
      reason: 'competitor mention',
      complexity: 'high',
    };
  }

  if (DOUBT_RE.test(userMessage)) {
    return {
      model: SONNET_MODEL,
      reason: 'hesitation / doubt pattern',
      complexity: 'high',
    };
  }

  return {
    model: HAIKU_MODEL,
    reason: 'default simple turn',
    complexity: 'low',
  };
}
