const DEMO_BOOKING_URL =
  process.env.KALYO_DEMO_BOOKING_URL ?? 'https://calendly.com/osvaldo-21/demo-kalyo';

export function getDemoBookingUrl(): string {
  return DEMO_BOOKING_URL;
}

export function buildDemoSchedulingMessage(opts: {
  customerName?: string | null;
}): string {
  const greeting = opts.customerName?.trim() ? `, ${opts.customerName.trim()}` : '';

  return `¡Perfecto${greeting}! 🎯 Te agendo una demo personalizada con Osvaldo, fundador de Kalyo.

📅 ${DEMO_BOOKING_URL}

En 30 minutos verás:
✓ Las 100+ evaluaciones validadas con IA
✓ El asistente de voz Kaly en acción
✓ Cómo funciona la agenda y Kalyo Meet
✓ Reportes automáticos con interpretación IA

Calendly muestra los horarios en tu zona horaria.
¿Te queda alguna duda antes de agendar?`;
}
