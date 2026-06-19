const DEMO_BOOKING_URL =
  process.env.KALYO_DEMO_BOOKING_URL ?? 'https://calendly.com/osvaldo-21/demo-kalyo';

export function getDemoBookingUrl(): string {
  return DEMO_BOOKING_URL;
}

export function buildDemoSchedulingMessage(opts: {
  customerName?: string | null;
}): string {
  const greeting = opts.customerName?.trim() ? `, ${opts.customerName.trim()}` : '';

  return `¡Perfecto${greeting}! 🎯

Te paso el link directo para agendar tu demo personalizada de Kalyo:

📅 ${DEMO_BOOKING_URL}

Verás los horarios disponibles en TU zona horaria. Solo eliges el que te funcione y recibirás:
✓ Confirmación inmediata por email
✓ Invitación al calendario
✓ Recordatorio 24h antes
✓ Link de videollamada

La demo dura 30 minutos. Te muestro:
- Cómo aplicar evaluaciones con IA
- El asistente de voz Kaly
- Agenda + videollamadas Kalyo Meet
- Cómo se ve un reporte automático

¿Alguna duda antes de agendar? 🙌`;
}
