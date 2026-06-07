export type TrialOnboardingUser = {
  trial_user_name?: string | null;
  trial_user_email: string;
};

function displayName(user: TrialOnboardingUser): string {
  const name = user.trial_user_name?.trim();
  if (name) return name;
  const local = user.trial_user_email.split('@')[0]?.trim();
  return local || 'ahí';
}

export function formatDay1(user: TrialOnboardingUser): string {
  const name = displayName(user);
  return (
    `👋 Hola ${name}, soy Sofía. Te activaste el trial Pro de Kalyo ayer.\n\n` +
    `Tu primer paso recomendado:\n` +
    `1️⃣ Entra a app.kalyo.io\n` +
    `2️⃣ Login con tu email + password\n` +
    `3️⃣ Crea tu primer paciente (botón '+' arriba a la derecha)\n` +
    `4️⃣ Asígnale una evaluación\n\n` +
    `¿Necesitas ayuda con algún paso? Dime aquí mismo y te ayudo.`
  );
}

export function formatDay3(user: TrialOnboardingUser): string {
  const name = displayName(user);
  return (
    `${name}, ¿ya conoces la feature más diferenciadora de Kalyo?\n\n` +
    `🎙️ *Asistente de voz con IA*\n\n` +
    `Hablas con Kalyo como con un colega:\n` +
    `- 'Crea sesión para María del jueves 10am'\n` +
    `- 'Resume las últimas 3 sesiones de Juan'\n` +
    `- 'Genera reporte de evaluación de Ana'\n\n` +
    `Lo hace en segundos.\n\n` +
    `Mira cómo funciona: https://kalyo.io/#asistente-voz\n\n` +
    `Pruébalo en app.kalyo.io → botón micrófono abajo a la derecha.`
  );
}

export function formatDay7(user: TrialOnboardingUser, daysLeft: number): string {
  const name = displayName(user);
  return (
    `${name}, llevas 7 días con tu trial Pro (te quedan ${daysLeft}).\n\n` +
    `¿Cómo te está funcionando? ¿Lograste hacer tu primera evaluación o usar el asistente de voz?\n\n` +
    `Si tienes dudas o algo no funciona como esperabas, te puedo agendar 15 min con Osvaldo del equipo para que te muestre todo en vivo.\n\n` +
    `Solo dime 'agendar demo' y lo coordino.`
  );
}

export function formatDay13(user: TrialOnboardingUser): string {
  const name = displayName(user);
  return (
    `⚠️ ${name}, tu trial Pro vence en 2 días.\n\n` +
    `Lo que pierdes si no continúas:\n` +
    `✓ Asistente de voz con IA\n` +
    `✓ Evaluaciones ilimitadas\n` +
    `✓ Reportes ejecutivos automáticos\n` +
    `✓ Pacientes ilimitados (quedarás en 5)\n\n` +
    `Continuar con Pro cuesta $29/mes (cancelas cuando quieras).\n\n` +
    `¿Quieres continuar? Dime 'sí' y te paso el link de pago.`
  );
}

export function formatDay15(user: TrialOnboardingUser): string {
  const name = displayName(user);
  return (
    `🔥 ÚLTIMA OPORTUNIDAD ${name}.\n\n` +
    `Tu trial Pro vence HOY a las 23:59.\n\n` +
    `Por ser uno de nuestros primeros usuarios beta, te ofrezco:\n\n` +
    `*50% descuento en tu primer mes* con código PRIMER50\n` +
    `$14.50 el primer mes, después $29/mes normal.\n\n` +
    `Activa aquí: https://app.kalyo.io/billing?coupon=PRIMER50\n\n` +
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
