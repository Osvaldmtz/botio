import 'server-only';

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

export function mapQuickReplySelection(text: string): string | null {
  const normalized = text.trim().toLowerCase();
  if (/^1$|evaluaci[oó]n/i.test(normalized)) return 'El usuario eligió Evaluaciones — explícale las evaluaciones clínicas de Kalyo.';
  if (/^2$|precio|plan/i.test(normalized)) return 'El usuario eligió Precios — resume los planes Starter, Pro y Max.';
  if (/^3$|prueba|trial|gratis/i.test(normalized)) return 'El usuario eligió Prueba gratis — explica el flujo de 2 pasos (registro + email).';
  return null;
}
