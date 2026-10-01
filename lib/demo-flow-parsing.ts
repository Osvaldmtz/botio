import { parseTimeFromText } from '@/lib/calendar-slots';
import type { PendingDemoSlots } from '@/lib/demo-conversation';

const SLOT_PATTERNS: Record<1 | 2 | 3, RegExp[]> = {
  1: [/^(1|1️⃣|uno|primer[oa]?|el\s+1|1\.)$/i],
  2: [/^(2|2️⃣|dos|segund[oa]?|el\s+2|2\.)$/i],
  3: [/^(3|3️⃣|tres|tercer[oa]?|el\s+3|3\.)$/i],
};

const CUSTOM_CONFIRM_RE = /^(s[ií]|confirmo|confirmar|dale|ok|de acuerdo|perfecto)$/i;

export const TIME_REQUEST_RE =
  /(?:a\s+las\s+)?\d{1,2}[:.]\d{2}(?:\s*(?:am|pm))?|(?:a\s+)?las\s+\d{1,2}(?:\s*(?:horas?|hrs?|h))?(?:\s*(?:am|pm))?|\d{1,2}\s*(?:horas?|hrs?|am|pm)|(?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|manana|mañana)/i;

export const HALLUCINATION_PATTERNS = [
  /demo\s+(agendada|confirmada|reservada)/i,
  /te\s+(enviar[eé]|envío|envi[eé])\s+la\s+invitaci[oó]n/i,
  /listo.*google\s+meet/i,
  /confirmado.*(?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|\d{1,2}:\d{2})/i,
  /confirmo\s*:.*(?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|\d{1,2}:\d{2})/i,
  /tu opci[oó]n es la.*\d{1,2}:\d{2}/i,
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

export function parseReminderResponseChoice(text: string): 1 | 2 | 3 | null {
  const choice = parseSlotChoice(text, null);
  if (choice === 1 || choice === 2 || choice === 3) return choice;
  return null;
}

export function foldReminderText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Phrases that mean "move my demo" while a reminder is still open. */
export function looksLikeReminderReschedule(text: string): boolean {
  const folded = foldReminderText(text);
  return /\b(mas tarde|cambiar|no puedo|otro dia|despues|reagendar|otro horario)\b/.test(folded);
}

const LOST_CANCEL_RE =
  /no me interesa|no estoy interesad|ya no (?:me )?interesa|no quiero/;
const CONFIRM_CANCEL_RE = /^(?:cancelar|si,?\s*cancelar|confirmo cancelacion)$/;

export type ReminderAction =
  | { kind: 'ignore' }
  | { kind: 'confirm' }
  | { kind: 'reschedule' }
  | { kind: 'ask_cancel' }
  | { kind: 'cancel'; reason: string; pipeline: 'lost' | 'qualified' };

export type PendingSlotsActivity = {
  slots?: unknown[] | null;
  custom?: unknown;
  expires_at?: string | null;
} | null;

export function isPendingDemoSlotsExpired(
  pending: { expires_at?: string | null } | null | undefined,
  now = Date.now(),
): boolean {
  if (!pending?.expires_at) return false;
  const expiresAt = new Date(pending.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

export function hasActivePendingSlots(
  pending: PendingSlotsActivity,
  now = Date.now(),
): boolean {
  if (!pending || isPendingDemoSlotsExpired(pending, now)) return false;
  const hasSlots = Array.isArray(pending.slots) && pending.slots.length > 0;
  return hasSlots || Boolean(pending.custom);
}

export function pipelineStageForCancellationReason(reason: string): 'lost' | 'qualified' {
  return LOST_CANCEL_RE.test(foldReminderText(reason)) ? 'lost' : 'qualified';
}

export function formatCancellationAsk(): string {
  return (
    'Puedo cancelar la demo o reagendarla.\n\n' +
    'Si quieres otro horario, responde REAGENDAR.\n\n' +
    'Si prefieres cancelar, cuéntame la razón (opcional). ' +
    'Por ejemplo: "no me interesa" o "no puedo hoy". ' +
    'Si no quieres dar una razón, responde CANCELAR.'
  );
}

export type BookedConfirmDecision = 'confirm' | 'reschedule' | 'ignore';

export function decideBookedConfirmReply(message: string): BookedConfirmDecision {
  const folded = foldReminderText(message).trim();
  if (/^(si|ok|dale|confirmo|de acuerdo|perfecto)$/.test(folded)) return 'confirm';
  if (looksLikeReminderReschedule(message)) return 'reschedule';
  return 'ignore';
}

/**
 * Reminder 1/2/3 only runs when there is no active slot offer.
 * A numeric reply with pending slots belongs to confirm_demo_slot.
 */
export function decideReminderAction(params: {
  message: string;
  hasActivePendingSlots: boolean;
  awaitingCancelReason: boolean;
}): ReminderAction {
  if (params.hasActivePendingSlots) return { kind: 'ignore' };

  const raw = params.message.trim();
  const folded = foldReminderText(raw);

  if (params.awaitingCancelReason) {
    if (LOST_CANCEL_RE.test(folded)) {
      return { kind: 'cancel', reason: raw, pipeline: 'lost' };
    }
    if (/\bno puedo hoy\b/.test(folded)) {
      return { kind: 'cancel', reason: raw, pipeline: 'qualified' };
    }
    if (parseReminderResponseChoice(raw) === 2 || looksLikeReminderReschedule(raw)) {
      return { kind: 'reschedule' };
    }
    if (parseReminderResponseChoice(raw) === 3 || CONFIRM_CANCEL_RE.test(folded)) {
      return {
        kind: 'cancel',
        reason: 'cancelled_by_customer_via_reminder',
        pipeline: 'qualified',
      };
    }
    if (
      raw.length >= 12 &&
      raw.length <= 280 &&
      !raw.includes('?') &&
      !/^(hola|gracias|ok|buenas)\b/.test(folded)
    ) {
      return {
        kind: 'cancel',
        reason: raw,
        pipeline: pipelineStageForCancellationReason(raw),
      };
    }
    return { kind: 'ignore' };
  }

  const choice = parseReminderResponseChoice(raw);
  if (choice === 1) return { kind: 'confirm' };
  if (choice === 2 || looksLikeReminderReschedule(raw)) return { kind: 'reschedule' };
  if (choice === 3) return { kind: 'ask_cancel' };
  return { kind: 'ignore' };
}

export type AlternativeSlotDraft = {
  start: string;
  end: string;
  label_es: string;
  display_timezone: string;
  display_label: string;
};

export type PendingSlotsIdentity = {
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  customer_city?: string;
  customer_timezone: string;
  customer_city_label: string;
  display_timezone: string;
  display_label: string;
  expires_at?: string;
};

export type PendingSlotsDraft = PendingSlotsIdentity & {
  slots: AlternativeSlotDraft[];
  custom?: AlternativeSlotDraft;
  offered_at: string;
};

/** Alternatives from check_specific_time are stored even when nothing was pending before. */
export function pendingSlotsWithAlternatives(params: {
  existing: PendingSlotsDraft | null;
  alternatives: AlternativeSlotDraft[];
  identity: PendingSlotsIdentity;
  originalDemoAt?: string | null;
  nowIso: string;
}): PendingSlotsDraft | null {
  if (params.alternatives.length === 0) return null;
  const existing = params.existing;
  const expiresAt = existing?.expires_at || params.originalDemoAt || undefined;
  return {
    slots: params.alternatives,
    customer_email: existing?.customer_email || params.identity.customer_email,
    customer_name: existing?.customer_name || params.identity.customer_name,
    customer_phone: existing?.customer_phone || params.identity.customer_phone,
    customer_city: existing?.customer_city || params.identity.customer_city,
    customer_timezone: params.identity.customer_timezone || existing?.customer_timezone || '',
    customer_city_label:
      params.identity.customer_city_label || existing?.customer_city_label || '',
    display_timezone:
      existing?.display_timezone || params.identity.display_timezone,
    display_label: existing?.display_label || params.identity.display_label,
    offered_at: params.nowIso,
    ...(expiresAt ? { expires_at: expiresAt } : {}),
  };
}

export function hasCustomTimeRequest(text: string): boolean {
  return TIME_REQUEST_RE.test(text) && parseTimeFromText(text) !== null;
}

export function shouldInterceptDemoConfirm(
  pending: PendingDemoSlots | null,
  messageBody: string,
): boolean {
  if (!pending) return false;
  if (pending.custom && looksLikeEmail(messageBody)) return true;
  if (!pending.slots?.length) return false;
  return parseSlotChoice(messageBody, pending) !== null;
}

function looksLikeEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
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

function confirmDemoSlotSucceeded(
  toolsCalled: string[],
  toolResults?: Record<string, unknown>,
): boolean {
  if (!toolsCalled.includes('confirm_demo_slot')) return false;
  if (!toolResults || !Object.prototype.hasOwnProperty.call(toolResults, 'confirm_demo_slot')) {
    return true;
  }
  const raw = toolResults.confirm_demo_slot;
  if (!raw || typeof raw !== 'object') return false;
  return (raw as { status?: unknown }).status === 'success';
}

export function applyDemoConfirmationGuard(params: {
  replyText: string;
  toolsCalled: string[];
  toolResults?: Record<string, unknown>;
  conversationId: string;
}): { replyText: string; guarded: boolean } {
  if (
    !looksLikeDemoConfirmation(params.replyText) ||
    confirmDemoSlotSucceeded(params.toolsCalled, params.toolResults)
  ) {
    return { replyText: params.replyText, guarded: false };
  }

  console.error(
    `[demo-flow-warning] blocking demo confirmation without successful confirm_demo_slot | conv=${params.conversationId}`,
  );

  return {
    replyText:
      'Disculpa, déjame procesar tu confirmación. ¿Puedes confirmar de nuevo cuál slot prefieres (1, 2 o 3)?',
    guarded: true,
  };
}

const DEMO_TZ_TOOL_NAMES = ['check_specific_time', 'schedule_demo', 'confirm_demo_slot'] as const;

function extractDemoToolBotMessage(
  toolResults: Record<string, unknown>,
  toolName: string,
): string | null {
  const raw = toolResults[toolName];
  if (!raw || typeof raw !== 'object') return null;
  const msg = (raw as Record<string, unknown>).bot_message;
  return typeof msg === 'string' && msg.trim() ? msg.trim() : null;
}

/**
 * Force calendar tool bot_message as the user reply so Claude cannot rewrite
 * hours with wrong arithmetic (e.g. 14:00 Bogotá → 09:00 CDMX).
 */
export function applyDemoTimezoneToolGuard(params: {
  replyText: string;
  toolsCalled: string[];
  toolResults: Record<string, unknown>;
  conversationId: string;
}): { replyText: string; guarded: boolean } {
  for (const toolName of DEMO_TZ_TOOL_NAMES) {
    if (!params.toolsCalled.includes(toolName)) continue;
    const botMessage = extractDemoToolBotMessage(params.toolResults, toolName);
    if (!botMessage) continue;
    if (botMessage === params.replyText.trim()) {
      return { replyText: params.replyText, guarded: false };
    }
    console.log(
      `[demo-tz-guard] using ${toolName} bot_message verbatim | conv=${params.conversationId}`,
    );
    return { replyText: botMessage, guarded: true };
  }
  return { replyText: params.replyText, guarded: false };
}
