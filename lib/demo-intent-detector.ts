/**
 * Detects when a lead wants to schedule a live demo (Calendly flow).
 * Excludes pricing questions about demos ("¿cuánto cuesta la demo?").
 */
export function detectDemoIntent(message: string): boolean {
  const msg = message.toLowerCase().trim();
  if (!msg) return false;

  // Pricing / cost questions are NOT demo scheduling intent
  if (/\b(cu[áa]nto\s+cuesta|cu[áa]nto\s+vale|precio\s+de\s+la\s+demo|costo\s+de\s+la\s+demo)\b/i.test(msg)) {
    return false;
  }

  const demoPatterns = [
    /\b(quiero|me\s+gustar[íi]a|necesito|deseo)\s+(una\s+)?demo\b/i,
    /\b(ag[ée]ndame|ag[ée]ndar|reservar|programar)\s+(una\s+)?(demo|reuni[óo]n|cita|llamada)/i,
    /\bc[óo]mo\s+(puedo\s+)?(agendar|reservar|programar)/i,
    /\b(disponible|disponibilidad|horarios?)\b.*\b(demo|reuni[óo]n|cita|llamada)/i,
    /\b(demo|reuni[óo]n|cita|llamada)\b.*\b(disponible|disponibilidad|horarios?)/i,
    /\b(qu[ée]\s+horarios?|cu[áa]ndo\s+puedes?)\b/i,
    /\b(ll[áa]mame|c[áa]game\s+una\s+llamada)/i,
    /\b(quiero\s+hablar\s+con|hablar\s+con\s+(un\s+)?humano|alguien\s+de\s+ventas)\b/i,
    /\bagendar\s+demo\b/i,
  ];

  return demoPatterns.some((pattern) => pattern.test(msg));
}
