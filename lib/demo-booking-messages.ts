/** Official Kalyo demo booking URL. Prefer env override for staging experiments. */
export const DEMO_URL =
  process.env.KALYO_DEMO_BOOKING_URL ?? 'https://kalyo.io/demo';

/** User-facing host label — never a personal name. */
export const DEMO_HOST_TEAM_LABEL = 'nuestro equipo';

export function getDemoBookingUrl(): string {
  return DEMO_URL;
}

export function buildDemoSchedulingMessage(opts: {
  customerName?: string | null;
}): string {
  const greeting = opts.customerName?.trim() ? `, ${opts.customerName.trim()}` : '';

  return `¡Perfecto${greeting}! 🎯 Te agendo una demo personalizada con nuestro equipo.

📅 ${DEMO_URL}

En 30 minutos verás:
✓ Más de 200 tests psicométricos estandarizados con IA
✓ El asistente de voz Kaly en acción
✓ Cómo funciona la agenda y Kalyo Meet
✓ Reportes automáticos con interpretación IA

Los horarios están en zona horaria de CDMX.
¿Te queda alguna duda antes de agendar?`;
}
