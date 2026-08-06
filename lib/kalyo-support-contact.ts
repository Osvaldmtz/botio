/** WhatsApp de atención humana (soporte Kalyo). */
export const KALYO_HUMAN_SUPPORT_WHATSAPP = '+52 811 411 2000';

/** Link click-to-chat para WhatsApp de soporte humano. */
export const KALYO_HUMAN_SUPPORT_WA_LINK = 'https://wa.me/528114112000';

export function humanSupportWelcomeFooter(): string {
  return (
    `\n\nY recuerda que si tienes alguna duda, nuestro equipo de atención está disponible en WhatsApp: ${KALYO_HUMAN_SUPPORT_WHATSAPP}`
  );
}

export function humanSupportTrialFooter(): string {
  return (
    `\n\nSi en algún momento necesitas ayuda, escríbenos directo al ${KALYO_HUMAN_SUPPORT_WHATSAPP} — hay un humano del otro lado 😊`
  );
}

/** Día 7 (columna day_15): invita a resolver dudas antes de decidir. */
export function humanSupportDay15Footer(): string {
  return (
    `\n\n¿Tienes dudas antes de decidir? Escríbenos por WhatsApp y te ayudamos a elegir el plan que mejor te funcione:\n${KALYO_HUMAN_SUPPORT_WA_LINK}`
  );
}
