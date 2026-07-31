import type { TrialOnboardingUser } from '@/lib/trial-onboarding-messages';
import { renderName } from '@/lib/render-name';

export type Day8SurveyResponse =
  | 'price'
  | 'features'
  | 'not_useful'
  | 'no_time'
  | 'not_used';

export const DAY8_SURVEY_LABELS: Record<Day8SurveyResponse, string> = {
  price: 'Precio',
  features: 'Faltan features',
  not_useful: 'No me sirvió',
  no_time: 'No tuve tiempo',
  not_used: 'No la usé',
};

function displayName(user: TrialOnboardingUser): string {
  const name = renderName(user.trial_user_name);
  if (name) return name;
  return renderName(user.trial_user_email.split('@')[0]) || 'ahí';
}

/** Día 8 — 192h post-enroll: encuesta post-trial. */
export function formatDay8Survey(user: TrialOnboardingUser): string {
  const name = displayName(user);
  return (
    `Hola ${name} 👋\n\n` +
    `Tu trial de Kalyo terminó ayer. ¿Qué te faltó para continuar?\n\n` +
    `Responde con el número o la opción:\n` +
    `1️⃣ Precio\n` +
    `2️⃣ Faltan features\n` +
    `3️⃣ No me sirvió\n` +
    `4️⃣ No tuve tiempo\n` +
    `5️⃣ No la usé\n\n` +
    `Tu respuesta nos ayuda a mejorar 🙏`
  );
}

export function parseDay8SurveyResponse(messageBody: string): Day8SurveyResponse | null {
  const raw = messageBody.trim().toLowerCase();
  if (!raw) return null;

  if (/^1$|precio|caro|costoso|muy caro/.test(raw)) return 'price';
  if (/^2$|feature|funcion|funciones|caracter[ií]stica|falta/.test(raw)) return 'features';
  if (/^3$|no me sirvi|no sirve|no me convence/.test(raw)) return 'not_useful';
  if (/^4$|no tuve tiempo|sin tiempo|ocupad|no time/.test(raw)) return 'no_time';
  if (/^5$|no la us[eé]|no entr[eé]|no us[eé]|nunca entr/.test(raw)) return 'not_used';

  return null;
}

export function formatDay8SurveyThankYou(response: Day8SurveyResponse): string {
  return `Gracias por tu respuesta (${DAY8_SURVEY_LABELS[response]}). Lo tendremos en cuenta para mejorar Kalyo 🙏`;
}
