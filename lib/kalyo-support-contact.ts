/** WhatsApp de atención humana (soporte Kalyo). */
export const KALYO_HUMAN_SUPPORT_WHATSAPP = '+52 811 411 2000';

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
