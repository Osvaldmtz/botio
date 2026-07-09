import 'server-only';
import { isAdPrefillMessage, isKalyoBotId } from '@/lib/conversation-utils';
import { normalizeForCache } from '@/lib/response-cache';

export const FAREWELL_NO_PROGRESS =
  'Parece que esta conversación no avanza hacia agendar una demo. ' +
  'Si eres psicólogo/a y quieres probar Kalyo, escríbeme directamente a hola@kalyo.io 👋';

export const QUICK_REPLY_OPTIONS = [
  { id: 'evaluaciones', title: 'Evaluaciones' },
  { id: 'precios', title: 'Precios' },
  { id: 'prueba_gratis', title: 'Prueba gratis' },
] as const;

export function appendQuickReplyPrompt(body: string): string {
  return (
    body +
    '\n\nResponde con una opción:\n' +
    '1️⃣ Evaluaciones\n' +
    '2️⃣ Precios\n' +
    '3️⃣ Prueba gratis'
  );
}

const PURCHASE_OR_TRIAL_INTENT_RE =
  /quiero\s+(?:el\s+)?(?:plan\s+)?pro|quiero\s+comprar|quiero\s+(?:el\s+)?trial|lo\s+quiero|voy\s+a\s+contratar|regalame\s+los\s+15|me\s+ingresa|me\s+apunto|lo\s+tomo|lo\s+contrato|quiero\s+pagar|c[oó]mo\s+pago|lo\s+activo|quiero\s+suscribir|acepto|quiero\s+comprarlo|prueba\s+gratis|activar\s+(?:mi\s+)?(?:trial|prueba)/i;

const SIMPLE_GREETING_RE =
  /^(hola|buenos dias|buenas tardes|buenas noches|que tal|hey|holi)$/;

export function hasPurchaseOrTrialIntent(text: string): boolean {
  return PURCHASE_OR_TRIAL_INTENT_RE.test(text);
}

export function isSimpleGreetingMessage(text: string): boolean {
  const normalized = normalizeForCache(text);
  return SIMPLE_GREETING_RE.test(normalized);
}

export function replySkipsQuickReplies(replyText: string): boolean {
  return /¿ya tienes cuenta|nombre completo y email|compartes tu email|trial pro de 15/i.test(
    replyText,
  );
}

export function shouldAttachQuickReplies(input: {
  channel: string;
  botId: string;
  totalUserMsgs: number;
  messageBody: string;
  hadToolUse: boolean;
  source: string;
  replyText: string;
}): boolean {
  if (input.channel !== 'whatsapp' || !isKalyoBotId(input.botId)) return false;
  if (input.totalUserMsgs !== 1) return false;
  if (input.hadToolUse) return false;
  if (input.source === 'ab-test' || input.source === 'cache') return false;
  if (isAdPrefillMessage(input.messageBody)) return false;
  if (hasPurchaseOrTrialIntent(input.messageBody)) return false;
  if (!isSimpleGreetingMessage(input.messageBody)) return false;
  if (replySkipsQuickReplies(input.replyText)) return false;
  return true;
}

export function mapQuickReplySelection(text: string): string | null {
  const normalized = text.trim().toLowerCase();
  if (/^1$|evaluaci[oó]n/i.test(normalized)) {
    return 'El usuario eligió Evaluaciones — explícale las evaluaciones clínicas de Kalyo. NO incluyas quick replies al final.';
  }
  if (/^2$|precio|plan/i.test(normalized)) {
    return 'El usuario eligió Precios — presenta Max primero como recomendado, luego Pro como alternativa más básica. Usa datos oficiales de planes. NO incluyas quick replies al final.';
  }
  if (/^3$|prueba|trial|gratis/i.test(normalized)) {
    return 'El usuario eligió Prueba gratis — inicia el Flujo Único de Trial: ofrece trial Pro 15 días sin tarjeta y pregunta "¿Ya tienes cuenta en Kalyo o es tu primera vez?". NO incluyas quick replies al final.';
  }
  return null;
}
