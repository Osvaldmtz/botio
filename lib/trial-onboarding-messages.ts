import { getPaymentLink } from '@/lib/kalyo-payment-links';
import { KALYO_PRICING } from '@/lib/kalyo-pricing-data';
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
    `👋 ${greeting} soy Sofía. Te activaste el trial Max de Kalyo ayer.\n\n` +
    `Tu primer paso recomendado:\n` +
    `1️⃣ Entra a https://app.kalyo.io/login\n` +
    `2️⃣ Login con tu email + password\n` +
    `3️⃣ Crea tu primer paciente (botón '+' arriba a la derecha)\n\n` +
    `¿Necesitas ayuda con algún paso? Dime aquí mismo y te ayudo.`
  );
}

export function formatDay3(user: TrialOnboardingUser): string {
  const name = displayName(user);
  const opener = name ? `${name}, ¿ya aplicaste` : '¿Ya aplicaste';
  return (
    `${opener} una evaluación con IA?\n\n` +
    `📊 *Evaluaciones con reporte automático*\n\n` +
    `Prueba con PHQ-9 o GAD-7:\n` +
    `1. Crea o abre un paciente\n` +
    `2. Asigna la evaluación\n` +
    `3. El paciente responde desde su celular\n` +
    `4. Recibes el reporte con interpretación IA al instante\n\n` +
    `Hazlo en https://app.kalyo.io/login`
  );
}

export function formatDay7(user: TrialOnboardingUser, daysLeft: number): string {
  const name = displayName(user);
  const opener = name ? `${name}, llevas` : 'Llevas';
  return (
    `${opener} 5 días con tu trial Max (te quedan ${daysLeft}).\n\n` +
    `¿Ya probaste Kaly voz? Dile algo como:\n` +
    `🎙️ *"Agenda cita mañana 3pm con María"*\n\n` +
    `Kaly ejecuta por ti sin tocar la pantalla — agenda, expedientes y notas.\n\n` +
    `Pruébalo en https://app.kalyo.io/login → botón micrófono abajo a la derecha.\n\n` +
    `Si tienes dudas, dime 'agendar demo' y coordino 30 minutos con Osvaldo.`
  );
}

export function formatDay13(user: TrialOnboardingUser): string {
  const name = displayName(user);
  const opener = name ? `⚠️ ${name}, tu trial` : '⚠️ Tu trial';
  return (
    `${opener} Max termina mañana.\n\n` +
    `¿Te quedas con *Max* ($${KALYO_PRICING.max.price_monthly}/mes) o prefieres *Pro* ($${KALYO_PRICING.pro.price_monthly}/mes)?\n\n` +
    `🚀 Max (recomendado): ${getPaymentLink('max')}\n` +
    `💎 Pro (más básico): ${getPaymentLink('pro')}\n\n` +
    `Cancelas cuando quieras desde Configuración. Si eliges Pro, sin problema — dime cuál prefieres.`
  );
}

export function formatDay15(user: TrialOnboardingUser): string {
  const name = displayName(user);
  const opener = name ? `🔥 ${name}, tu trial` : '🔥 Tu trial';
  return (
    `${opener} Max venció.\n\n` +
    `Continúa con el plan que prefieras:\n\n` +
    `🚀 Max $${KALYO_PRICING.max.price_monthly}/mes (recomendado): ${getPaymentLink('max')}\n` +
    `💎 Pro $${KALYO_PRICING.pro.price_monthly}/mes (más básico): ${getPaymentLink('pro')}\n\n` +
    `Cancelas cuando quieras desde Configuración.`
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
