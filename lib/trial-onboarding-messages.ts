import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getPaymentLink } from '@/lib/kalyo-payment-links';
import { KALYO_PRICING } from '@/lib/kalyo-pricing-data';
import { renderName } from '@/lib/render-name';

export type TrialOnboardingUser = {
  trial_user_name?: string | null;
  trial_user_email: string;
};

export type TrialOnboardingMessageContext = TrialOnboardingUser & {
  trialEndsAt: string;
  email?: string;
  tempPassword?: string;
};

/** Narrative day numbers (legacy DB columns mapped in cron). */
export type OnboardingNarrativeDay = 1 | 2 | 3 | 5 | 6 | 7 | 9;

function displayName(user: TrialOnboardingUser): string {
  const name = renderName(user.trial_user_name);
  if (name) return name;
  return renderName(user.trial_user_email.split('@')[0]) || 'ahí';
}

export function formatTrialEndDateLabel(iso: string): string {
  try {
    return format(new Date(iso), 'd MMM yyyy', { locale: es });
  } catch {
    return iso.slice(0, 10);
  }
}

/** Día 1 — inmediato al activar trial (welcome + credenciales). */
export function formatDay1Welcome(ctx: TrialOnboardingMessageContext): string {
  const name = displayName(ctx);
  const endDate = formatTrialEndDateLabel(ctx.trialEndsAt);
  const email = ctx.email?.trim() || ctx.trial_user_email;
  const passwordLine = ctx.tempPassword
    ? `🔑 ${ctx.tempPassword}\n`
    : '🔑 (revisa el mensaje anterior o usa "Olvidé mi contraseña")\n';

  return (
    `¡Hola ${name}! 👋 Soy Sofía.\n` +
    `Tu trial Max de 7 días está activo. Vence el ${endDate}.\n\n` +
    `🔐 Acceso:\n` +
    `📧 ${email}\n` +
    passwordLine +
    `🌐 https://app.kalyo.io/login\n\n` +
    `📋 Primer paso:\n` +
    `Entra y crea tu primer paciente.\n\n` +
    `¿Dudas? Aquí estoy 🚀`
  );
}

/** Día 2 — 24h: recordatorio primer paciente. */
export function formatDay2(user: TrialOnboardingUser): string {
  const name = displayName(user);
  return (
    `¡Hola ${name}!\n` +
    `¿Ya entraste a Kalyo?\n\n` +
    `Con solo tu primer paciente empiezas a ver el valor.\n` +
    `Te tomará 2 minutos.\n\n` +
    `https://app.kalyo.io/patients/new`
  );
}

/** Día 3 — 72h: evaluaciones. */
export function formatDay3(user: TrialOnboardingUser): string {
  const name = displayName(user);
  return (
    `Hola ${name} 👋\n\n` +
    `Hoy prueba las evaluaciones.\n` +
    `Aplica PHQ-9 (depresión) o GAD-7 (ansiedad) — son las más usadas en clínica.\n\n` +
    `Kalyo las interpreta con IA y genera reporte automático.\n\n` +
    `https://app.kalyo.io/assessments/new`
  );
}

/** Día 5 — 120h: features Max (legacy column day_7). */
export function formatDay5(user: TrialOnboardingUser): string {
  const name = displayName(user);
  return (
    `Hola ${name} 👋\n\n` +
    `Prueba las 2 features estrella:\n\n` +
    `🎤 Kaly voz — dile: 'agenda cita mañana 3pm'\n` +
    `📹 Kalyo Meet — programa una sesión virtual\n\n` +
    `Son las razones por las que Max vale $${KALYO_PRICING.max.price_monthly} (vs Pro $${KALYO_PRICING.pro.price_monthly}).\n\n` +
    `Te quedan 2 días de trial.`
  );
}

/** Día 6 — 144h: termina mañana (legacy column day_13). */
export function formatDay6(user: TrialOnboardingUser): string {
  const name = displayName(user);
  return (
    `${name}, tu trial Max termina mañana.\n\n` +
    `¿Te quedas con:\n` +
    `🚀 Max $${KALYO_PRICING.max.price_monthly}/mes (recomendado)\n` +
    `💎 Pro $${KALYO_PRICING.pro.price_monthly}/mes (sin Meet ni Kaly voz)\n\n` +
    `Responde MAX o PRO.`
  );
}

/** Día 7 — 168h: venció (legacy column day_15). */
export function formatDay7Expired(): string {
  return (
    `Tu trial Max venció hoy.\n\n` +
    `Para continuar con acceso completo:\n` +
    `🚀 Max $${KALYO_PRICING.max.price_monthly}/mes\n` +
    `💎 Pro $${KALYO_PRICING.pro.price_monthly}/mes\n\n` +
    `Sin decisión, tu cuenta pasa a modo free (${KALYO_PRICING.starter.max_patients} pacientes).`
  );
}

/** Día 9 — 216h: PRIMER50 (condicional). */
export function formatDay9WithCoupon(user: TrialOnboardingUser): string {
  const name = displayName(user);
  const code = KALYO_PRICING.discount.code;
  const maxLink = getPaymentLink('max', code);
  const proLink = getPaymentLink('pro', code);

  return (
    `Hola ${name} 👋\n\n` +
    `Vi que tu trial Max terminó hace 2 días y no has continuado.\n\n` +
    `Te dejo una oferta especial:\n\n` +
    `🎁 *50% OFF el primer mes*\n` +
    `🚀 Max: $${KALYO_PRICING.discount.max_with_discount} (era $${KALYO_PRICING.max.price_monthly})\n` +
    `💎 Pro: $${KALYO_PRICING.discount.pro_with_discount} (era $${KALYO_PRICING.pro.price_monthly})\n\n` +
    `Cupón: ${code}\n\n` +
    `${maxLink}\n` +
    `${proLink}\n\n` +
    `Válida solo si no habías contratado antes.\n` +
    `¿Cuál te sirve?`
  );
}

/** Día 9 — sin repetir cupón. */
export function formatDay9NoCoupon(user: TrialOnboardingUser): string {
  const name = displayName(user);
  return (
    `Hola ${name}\n` +
    `Te espero cuando estés listo para continuar con Kalyo.\n` +
    `Si tienes dudas sobre planes, aquí estoy.`
  );
}

/** @deprecated Use formatDay6 — kept for tests migrating from day_13 label. */
export const formatDay13 = formatDay6;

/** @deprecated Use formatDay7Expired — kept for tests migrating from day_15 label. */
export const formatDay15 = formatDay7Expired;

/** @deprecated Use formatDay5 — legacy day_7 column maps to narrative day 5. */
export function formatDay7(user: TrialOnboardingUser): string {
  return formatDay5(user);
}

export function formatOnboardingMessage(
  day: OnboardingNarrativeDay,
  user: TrialOnboardingUser,
  trialEndsAt: string,
  extras?: { email?: string; tempPassword?: string },
): string {
  const ctx: TrialOnboardingMessageContext = {
    ...user,
    trialEndsAt,
    email: extras?.email,
    tempPassword: extras?.tempPassword,
  };

  switch (day) {
    case 1:
      return formatDay1Welcome(ctx);
    case 2:
      return formatDay2(user);
    case 3:
      return formatDay3(user);
    case 5:
      return formatDay5(user);
    case 6:
      return formatDay6(user);
    case 7:
      return formatDay7Expired();
    case 9:
      return formatDay9WithCoupon(user);
    default:
      return formatDay2(user);
  }
}
