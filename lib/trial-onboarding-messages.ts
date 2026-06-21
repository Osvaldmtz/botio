import { getPaymentLink } from '@/lib/kalyo-payment-links';
import { renderName } from '@/lib/render-name';

export type TrialOnboardingUser = {
  trial_user_name?: string | null;
  trial_user_email: string;
};

function displayName(user: TrialOnboardingUser): string {
  const name = renderName(user.trial_user_name);
  if (name) return name;
  return renderName(user.trial_user_email.split('@')[0]);
}

export function formatDay1(user: TrialOnboardingUser): string {
  const name = displayName(user);
  const greeting = name ? `Hola ${name},` : 'Hola,';
  return (
    `👋 ${greeting} soy Sofía. Te activaste el trial Pro de Kalyo ayer.\n\n` +
    `Tu primer paso recomendado:\n` +
    `1️⃣ Entra a https://app.kalyo.io/login\n` +
    `2️⃣ Login con tu email + password\n` +
    `3️⃣ Crea tu primer paciente (botón '+' arriba a la derecha)\n` +
    `4️⃣ Asígnale una evaluación\n\n` +
    `¿Necesitas ayuda con algún paso? Dime aquí mismo y te ayudo.`
  );
}

export function formatDay3(user: TrialOnboardingUser): string {
  const name = displayName(user);
  const opener = name ? `${name}, ¿ya conoces` : '¿Ya conoces';
  return (
    `${opener} la feature más diferenciadora de Kalyo?\n\n` +
    `🎙️ *Asistente de voz con IA*\n\n` +
    `Hablas con Kalyo como con un colega:\n` +
    `- 'Crea sesión para María del jueves 10am'\n` +
    `- 'Resume las últimas 3 sesiones de Juan'\n` +
    `- 'Genera reporte de evaluación de Ana'\n\n` +
    `Lo hace en segundos.\n\n` +
    `Mira cómo funciona: https://kalyo.io/#asistente-voz\n\n` +
    `Pruébalo en https://app.kalyo.io/login → botón micrófono abajo a la derecha.`
  );
}

export function formatDay7(user: TrialOnboardingUser, daysLeft: number): string {
  const name = displayName(user);
  const opener = name ? `${name}, llevas` : 'Llevas';
  return (
    `${opener} 7 días con tu trial Pro (te quedan ${daysLeft}).\n\n` +
    `¿Cómo te está funcionando? ¿Lograste hacer tu primera evaluación o usar el asistente de voz?\n\n` +
    `Si tienes dudas o algo no funciona como esperabas, te puedo agendar 30 minutos con Osvaldo del equipo para que te muestre todo en vivo.\n\n` +
    `Solo dime 'agendar demo' y lo coordino.`
  );
}

export function formatDay13(user: TrialOnboardingUser): string {
  const name = displayName(user);
  const opener = name ? `⚠️ ${name}, tu trial` : '⚠️ Tu trial';
  return (
    `${opener} Pro vence en 2 días.\n\n` +
    `Lo que pierdes si no continúas:\n` +
    `✓ Asistente de voz con IA\n` +
    `✓ Evaluaciones ilimitadas\n` +
    `✓ Reportes ejecutivos automáticos\n` +
    `✓ Pacientes ilimitados (quedarás en 5)\n\n` +
    `Continuar cuesta:\n` +
    `💎 Pro $29/mes: ${getPaymentLink('pro')}\n` +
    `🚀 Max $39/mes (incluye asistente de voz): ${getPaymentLink('max')}\n\n` +
    `Cancelas cuando quieras desde Configuración.`
  );
}

export function formatDay15(user: TrialOnboardingUser): string {
  const name = displayName(user);
  const opener = name ? `🔥 ÚLTIMA OPORTUNIDAD ${name}.` : '🔥 ÚLTIMA OPORTUNIDAD.';
  return (
    `${opener}\n\n` +
    `Tu trial Pro vence HOY a las 23:59.\n\n` +
    `Por ser uno de nuestros primeros usuarios beta, te ofrezco:\n\n` +
    `*50% descuento en tu primer mes* (código PRIMER50, aplicado automáticamente)\n\n` +
    `💎 Pro $14.50 primer mes: ${getPaymentLink('pro', 'PRIMER50')}\n` +
    `🚀 Max $19.50 primer mes: ${getPaymentLink('max', 'PRIMER50')}\n\n` +
    `Después del primer mes vuelves al precio normal. Cancelas cuando quieras.\n\n` +
    `Después de hoy, este descuento ya no aplica.`
  );
}

export function formatOnboardingMessage(
  day: 1 | 3 | 7 | 13 | 15,
  user: TrialOnboardingUser,
  trialEndsAt: string,
): string {
  if (day === 7) {
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    );
    return formatDay7(user, daysLeft);
  }
  if (day === 1) return formatDay1(user);
  if (day === 3) return formatDay3(user);
  if (day === 13) return formatDay13(user);
  return formatDay15(user);
}
