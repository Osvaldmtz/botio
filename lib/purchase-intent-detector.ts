export type PurchaseIntentType = 'plan_max' | 'plan_pro' | 'pay_now' | null;

export type PurchaseIntent = {
  intent: PurchaseIntentType;
  plan?: 'max' | 'pro';
};

const PLAN_MAX_RE =
  /\b(?:quiero|me\s+gustar[íi]a|necesito|dame|prefiero|tomar[eé])\b.{0,40}\b(?:plan\s+)?max\b/i;
const PLAN_MAX_SUFFIX_RE = /\b(?:plan\s+)?max\b.{0,20}\b(?:por\s+favor|please|ya)\b/i;
// "el max" solo al inicio de mensaje o sin contexto de pregunta
const PLAN_MAX_SHORT_RE = /^(?:el\s+max|el\s+plan\s+max)\b/i;

const PLAN_PRO_RE =
  /\b(?:quiero|me\s+gustar[íi]a|necesito|dame|prefiero|tomar[eé])\b.{0,40}\b(?:plan\s+)?pro\b/i;
const PLAN_PRO_SUFFIX_RE = /\b(?:plan\s+)?pro\b.{0,20}\b(?:por\s+favor|please|ya)\b/i;
// "el pro" solo al inicio de mensaje
const PLAN_PRO_SHORT_RE = /^(?:el\s+pro|el\s+plan\s+pro)\b/i;

const PAY_NOW_RE =
  /\b(?:quiero\s+pagar|listo\s+para\s+pagar|c[óo]mo\s+pago|c[óo]mo\s+compro|dame\s+el\s+link\s+de\s+pago|link\s+de\s+pago|p[áa]gina\s+de\s+pago|env[íi]am[eé]\s+el\s+link|m[áa]ndam[eé]\s+el\s+link|pa[sS]am[eé]\s+el\s+link)\b/i;

/**
 * Detects explicit purchase intent from a message.
 * Only fires on strong purchase signals — NOT on questions like "cuánto cuesta el max?".
 */
export function detectPurchaseIntent(message: string): PurchaseIntent {
  if (
    PLAN_MAX_RE.test(message) ||
    PLAN_MAX_SUFFIX_RE.test(message) ||
    PLAN_MAX_SHORT_RE.test(message)
  ) {
    return { intent: 'plan_max', plan: 'max' };
  }

  if (
    PLAN_PRO_RE.test(message) ||
    PLAN_PRO_SUFFIX_RE.test(message) ||
    PLAN_PRO_SHORT_RE.test(message)
  ) {
    return { intent: 'plan_pro', plan: 'pro' };
  }

  if (PAY_NOW_RE.test(message)) {
    return { intent: 'pay_now' };
  }

  return { intent: null };
}
