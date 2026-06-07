import { parseTimeFromText } from '@/lib/calendar-slots';
import type { PendingDemoSlots } from '@/lib/demo-conversation';

const SLOT_PATTERNS: Record<1 | 2 | 3, RegExp[]> = {
  1: [/^(1|1️⃣|uno|primer[oa]?|el\s+1|1\.)$/i],
  2: [/^(2|2️⃣|dos|segund[oa]?|el\s+2|2\.)$/i],
  3: [/^(3|3️⃣|tres|tercer[oa]?|el\s+3|3\.)$/i],
};

const CUSTOM_CONFIRM_RE = /^(s[ií]|confirmo|confirmar|dale|ok|de acuerdo|perfecto)$/i;

export const TIME_REQUEST_RE =
  /(?:a\s+las\s+)?\d{1,2}[:.]\d{2}(?:\s*(?:am|pm))?|\d{1,2}\s*(?:am|pm)|(?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|manana|mañana)/i;

export const HALLUCINATION_PATTERNS = [
  /demo\s+(agendada|confirmada|reservada)/i,
  /te\s+(enviar[eé]|envío)\s+la\s+invitaci[oó]n/i,
  /listo.*google\s+meet/i,
  /confirmado.*(?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado)/i,
  /confirmado:\s*demo/i,
];

export function parseSlotChoice(
  text: string,
  pending?: PendingDemoSlots | null,
): 1 | 2 | 3 | 'custom' | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const slot of [1, 2, 3] as const) {
    if (SLOT_PATTERNS[slot].some((re) => re.test(trimmed))) {
      return slot;
    }
  }

  if (pending?.custom && CUSTOM_CONFIRM_RE.test(trimmed)) {
    return 'custom';
  }

  if (/^custom$/i.test(trimmed)) {
    return 'custom';
  }

  return null;
}

export function hasCustomTimeRequest(text: string): boolean {
  return TIME_REQUEST_RE.test(text) && parseTimeFromText(text) !== null;
}

export function shouldInterceptDemoConfirm(
  pending: PendingDemoSlots | null,
  messageBody: string,
): boolean {
  if (!pending?.slots?.length) return false;
  return parseSlotChoice(messageBody, pending) !== null;
}

export function shouldInterceptDemoTimeCheck(
  pending: PendingDemoSlots | null,
  messageBody: string,
): boolean {
  if (!pending) return false;
  if (parseSlotChoice(messageBody, pending) !== null) return false;
  return hasCustomTimeRequest(messageBody);
}

export function looksLikeDemoConfirmation(text: string): boolean {
  return HALLUCINATION_PATTERNS.some((re) => re.test(text));
}

export function applyDemoConfirmationGuard(params: {
  replyText: string;
  toolsCalled: string[];
  conversationId: string;
}): { replyText: string; guarded: boolean } {
  const confirmedViaTool = params.toolsCalled.includes('confirm_demo_slot');
  if (confirmedViaTool || !looksLikeDemoConfirmation(params.replyText)) {
    return { replyText: params.replyText, guarded: false };
  }

  console.error(
    `[demo-flow-warning] LLM hallucinated demo confirmation without tool call | conv=${params.conversationId}`,
  );

  return {
    replyText:
      'Disculpa, déjame procesar tu confirmación. ¿Puedes confirmar de nuevo cuál slot prefieres (1, 2 o 3)?',
    guarded: true,
  };
}
