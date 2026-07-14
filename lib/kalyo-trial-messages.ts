import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  TRIAL_MAX_FEATURE_BULLETS,
  trialPlanLabel,
  type TrialPlanChoice,
} from '@/lib/kalyo-trial-plans';

function formatTrialEndDate(iso: string): string {
  try {
    return format(new Date(iso), 'd MMM yyyy', { locale: es });
  } catch {
    return iso.slice(0, 10);
  }
}

export function buildTrialMaxFeaturesBlock(): string {
  return TRIAL_MAX_FEATURE_BULLETS.map((f) => `• ${f}`).join('\n');
}

export function buildTrialActivationSuccessMessage(params: {
  email: string;
  fullName?: string | null;
  trialEndsAt: string;
  trialPlan?: TrialPlanChoice;
  reactivated?: boolean;
  tempPassword?: string;
}): string {
  const plan = params.trialPlan ?? 'max';
  const planName = trialPlanLabel(plan);
  const trialDate = formatTrialEndDate(params.trialEndsAt);
  const name = params.fullName?.trim();
  const greeting = name ? `¡Listo ${name}!` : '¡Listo!';

  if (params.reactivated) {
    const passwordLine = params.tempPassword
      ? `\n🔑 Contraseña temporal: ${params.tempPassword}\n(Puedes cambiarla después de entrar)\n`
      : '\nSi olvidaste tu contraseña, usa "Olvidé mi contraseña" en el login.\n';

    return (
      `${greeting} Tu trial ${planName} está activo 🎉 Entra aquí: https://app.kalyo.io/login — tu email es ${params.email}.${passwordLine}\n` +
      `Tu trial ${planName} de 15 días empezó hoy. Termina el ${trialDate}.\n\n` +
      (plan === 'max' ? `Incluye:\n${buildTrialMaxFeaturesBlock()}\n\n` : '') +
      `¿Te ayudo con el setup inicial?`
    );
  }

  const passwordLine = params.tempPassword
    ? `\n🔑 Contraseña temporal: ${params.tempPassword}\n(Puedes cambiarla después de entrar)\n`
    : '\n';

  const maxFeatures =
    plan === 'max' ? `\nIncluye:\n${buildTrialMaxFeaturesBlock()}\n` : '';

  return (
    `${greeting} Tu cuenta está activa 🎉 Entra aquí: https://app.kalyo.io/login — tu email es ${params.email}.${passwordLine}` +
    `Tu trial ${planName} de 15 días empezó hoy. Termina el ${trialDate}.${maxFeatures}\n` +
    `¿Te ayudo con el setup inicial?`
  );
}

export function buildImmediateWelcomeMessage(
  name: string,
  options?: { email?: string; tempPassword?: string; trialPlan?: TrialPlanChoice },
): string {
  const display = name.trim() || 'ahí';
  const planName = trialPlanLabel(options?.trialPlan ?? 'max');
  const credentials =
    options?.email && options?.tempPassword
      ? `\n\nTus datos de acceso:\n📧 Email: ${options.email}\n🔑 Contraseña temporal: ${options.tempPassword}\n(Puedes cambiarla después de entrar)\n`
      : '';

  const maxBlock =
    (options?.trialPlan ?? 'max') === 'max'
      ? `\nIncluye:\n${buildTrialMaxFeaturesBlock()}\n`
      : '';

  return (
    `¡Hola ${display}! 👋 Soy Sofía, asistente de Kalyo.\n\n` +
    `Tu trial ${planName} de 15 días está activo. Aquí estaré para resolverte dudas o ayudarte durante este tiempo.` +
    maxBlock +
    credentials +
    `\nTu primer paso:\n` +
    `1️⃣ Entra a app.kalyo.io/login\n` +
    `2️⃣ Crea tu primer paciente\n` +
    `3️⃣ Aplica una evaluación con IA\n\n` +
    `Cualquier duda, escríbeme. ¡Bienvenido/a! 🎉`
  );
}

export function buildDirectEnrollmentWelcomeMessage(input: {
  fullName: string;
  email: string;
  trialEndsAt: string;
  isNewAccount: boolean;
  tempPassword?: string;
  trialPlan?: TrialPlanChoice;
}): string {
  const name = input.fullName?.trim() || 'Doctor/a';
  const endDate = formatTrialEndDate(input.trialEndsAt);
  const plan = input.trialPlan ?? 'max';
  const planName = trialPlanLabel(plan);
  const maxBlock = plan === 'max' ? `\nIncluye:\n${buildTrialMaxFeaturesBlock()}\n` : '';

  if (input.isNewAccount) {
    return (
      `¡Hola ${name}! 👋 Soy Sofía de Kalyo.\n\n` +
      `Tu trial ${planName} de 15 días está activo. Vence el ${endDate}.${maxBlock}\n` +
      `🔐 *Acceso a tu cuenta:*\n` +
      `🌐 https://app.kalyo.io/login\n` +
      `📧 Email: ${input.email}\n` +
      `🔑 Contraseña: ${input.tempPassword}\n\n` +
      `(Te recomendamos cambiarla en Configuración cuando entres)\n\n` +
      `📋 *Primeros pasos:*\n` +
      `1. Entra y crea tu primer paciente\n` +
      `2. Aplica una evaluación (PHQ-9 es buena para empezar)\n` +
      `3. Prueba Kaly voz — dile "agenda cita mañana 3pm"\n\n` +
      `¿Dudas? Aquí estoy. 🚀`
    );
  }

  return (
    `¡Hola ${name}! 👋 Soy Sofía de Kalyo.\n\n` +
    `Reactivamos tu trial ${planName} por 15 días más. Vence el ${endDate}.${maxBlock}\n` +
    `🔐 *Acceso a tu cuenta:*\n` +
    `🌐 https://app.kalyo.io/login\n` +
    `📧 Email: ${input.email}\n` +
    (input.tempPassword
      ? `🔑 Contraseña: ${input.tempPassword}\n\n(Te recomendamos cambiarla en Configuración cuando entres)\n\n`
      : `\nSi olvidaste tu contraseña, usa "Olvidé mi contraseña" en el login.\n\n`) +
    `¿Dudas? Aquí estoy. 🚀`
  );
}

export function buildAdminOperatorTrialConfirmation(params: {
  fullName: string;
  email: string;
  phone: string;
  trialEndsAt: string;
  tempPassword?: string;
  reactivated?: boolean;
  welcomeSent: boolean;
  trialPlan?: TrialPlanChoice;
}): string {
  const planName = trialPlanLabel(params.trialPlan ?? 'max');
  const trialDate = formatTrialEndDate(params.trialEndsAt);
  const name = params.fullName.trim() || params.email;

  let message = `✅ Trial ${planName} activado para ${name}\n\n`;
  message += `📧 Email: ${params.email}\n`;
  if (params.tempPassword) {
    message += `🔑 Contraseña temporal: ${params.tempPassword}\n`;
  }
  message += `📱 WhatsApp: ${params.phone}\n`;
  message += `⏰ Trial termina: ${trialDate}\n\n`;

  if (params.welcomeSent) {
    message += params.tempPassword
      ? 'El mensaje de bienvenida con email y contraseña ya fue enviado a su WhatsApp.\n'
      : 'El mensaje de bienvenida ya fue enviado a su WhatsApp.\n';
  } else {
    message +=
      'El trial quedó activo; el welcome no se reenvió (posible enrolamiento previo).\n';
  }

  message += 'Puede entrar a: https://app.kalyo.io/login';
  return message;
}
