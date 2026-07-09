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
    `👋 ${greeting} soy Sofía. Te activaste el trial Pro de Kalyo ayer.\n\n` +
    `Tu primer paso recomendado:\n` +
    `1️⃣ Entra a https://app.kalyo.io/login\n` +
    `2️⃣ Login con tu email + password\n` +
    `3️⃣ Crea tu primer paciente (botón '+' arriba a la derecha)\n` +
    `4️⃣ Asígnale una evaluación\n\n` +
    `En el trial tienes evaluaciones ilimitadas, Kaly Voice y reportes IA. Si te gusta, al pagar te recomiendo *Max* ($${KALYO_PRICING.max.price_monthly}/mes) para agenda, videollamadas y transcripción.\n\n` +
    `¿Necesitas ayuda con algún paso? Dime aquí mismo y te ayudo.`
  );
}

export function formatDay3(user: TrialOnboardingUser): string {
  const name = displayName(user);
  const opener = name ? `${name}, ¿ya probaste` : '¿Ya probaste';
  return (
    `${opener} Kaly Voice?\n\n` +
    `🎙️ *Asistente de voz con IA* (incluido en tu trial Pro)\n\n` +
    `Hablas con Kaly como con un colega:\n` +
    `- 'Crea sesión para María del jueves 10am'\n` +
    `- 'Resume las últimas 3 sesiones de Juan'\n` +
    `- 'Genera reporte de evaluación de Ana'\n\n` +
    `En *Max* ($${KALYO_PRICING.max.price_monthly}/mes) además tienes agenda integrada, videollamadas y transcripción de sesiones.\n\n` +
    `Pruébalo en https://app.kalyo.io/login → botón micrófono abajo a la derecha.`
  );
}

export function formatDay7(user: TrialOnboardingUser, daysLeft: number): string {
  const name = displayName(user);
  const opener = name ? `${name}, llevas` : 'Llevas';
  return (
    `${opener} 7 días con tu trial Pro (te quedan ${daysLeft}).\n\n` +
    `¿Cómo te está funcionando? ¿Lograste hacer tu primera evaluación o usar Kaly Voice?\n\n` +
    `Si te gusta el flujo clínico, *Max* agrega agenda, videollamadas Daily.co, transcripción y portal del paciente — es el plan que más psicólogos eligen.\n\n` +
    `Si tienes dudas, dime 'agendar demo' y coordino 30 minutos con Osvaldo.`
  );
}

export function formatDay13(user: TrialOnboardingUser): string {
  const name = displayName(user);
  const opener = name ? `⚠️ ${name}, tu trial` : '⚠️ Tu trial';
  const discount = KALYO_PRICING.discount;
  return (
    `${opener} termina en 2 días.\n\n` +
    `¿Te quedas con *Max* (recomendado) o prefieres *Pro*?\n\n` +
    `🚀 *Max* $${KALYO_PRICING.max.price_monthly}/mes — agenda + videollamadas + transcripción + todo Pro:\n` +
    `${getPaymentLink('max')}\n\n` +
    `💎 *Pro* $${KALYO_PRICING.pro.price_monthly}/mes — evaluaciones ilimitadas + Kaly Voice + reportes IA:\n` +
    `${getPaymentLink('pro')}\n\n` +
    `Cupón ${discount.code}: 50% off primer mes (Max $${discount.max_with_discount}, Pro $${discount.pro_with_discount}).\n\n` +
    `Cancelas cuando quieras desde Configuración. Si eliges Pro, sin problema — dime cuál prefieres.`
  );
}

export function formatDay15(user: TrialOnboardingUser): string {
  const name = displayName(user);
  const opener = name ? `🔥 ÚLTIMA OPORTUNIDAD ${name}.` : '🔥 ÚLTIMA OPORTUNIDAD.';
  const discount = KALYO_PRICING.discount;
  return (
    `${opener}\n\n` +
    `Tu trial Pro vence HOY a las 23:59.\n\n` +
    `Por ser uno de nuestros primeros usuarios beta, te ofrezco:\n\n` +
    `*50% descuento en tu primer mes* (código ${discount.code}, aplicado automáticamente)\n\n` +
    `🚀 Max $${discount.max_with_discount} primer mes (recomendado): ${getPaymentLink('max', discount.code)}\n` +
    `💎 Pro $${discount.pro_with_discount} primer mes: ${getPaymentLink('pro', discount.code)}\n\n` +
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
