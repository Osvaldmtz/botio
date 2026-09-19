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

  // General info or clinical session context — not demo scheduling
  if (/\binformaci[óo]n\s+sobre\s+kalyo\b/i.test(msg)) return false;
  if (/\bcu[áa]nto\s+cuesta\b.*\bsesi[óo]n\b/i.test(msg)) return false;
  if (/\bsesi[óo]n\s+con\s+paciente/i.test(msg)) return false;

  const demoPatterns = [
    /\b(quiero|me\s+gustar[íi]a|necesito|deseo)\s+(una\s+)?demo\b/i,
    /\b(ag[ée]ndame|ag[ée]ndar|reservar|programar)\s+(una\s+)?(demo|reuni[óo]n|cita|llamada)/i,
    /\bc[óo]mo\s+(puedo\s+)?(hacer|agendar|agendo|agendas|tener|conseguir|programar|reservar)\s+(una\s+)?(cita|demo|reuni[óo]n|llamada|sesi[óo]n)\b/i,
    /\b(quiero|necesito|deseo|me\s+gustar[íi]a)\s+(una\s+)?(cita|reuni[óo]n|llamada|sesi[óo]n)\b/i,
    /\b(cita|reuni[óo]n|llamada)\s+con\s+(osvaldo|el\s+fundador|ventas|el\s+equipo)/i,
    /\bhablar\s+con\s+(osvaldo|el\s+fundador|ventas|alguien\s+del\s+equipo)/i,
    /\b(s[íi]\s+claro\s+con\s+osvaldo|con\s+osvaldo\s+por\s+favor)\b/i,
    /\b(ag[ée]ndamela|p[áa]same\s+el\s+link)\b/i,
    /\bc[óo]mo\s+(puedo\s+)?(agendar|agendo|agendas|reservar|programar)/i,
    /\bc[óo]mo\s+agend\w*\b/i,
    /\b(disponible|disponibilidad|horarios?)\b.*\b(demo|reuni[óo]n|cita|llamada)/i,
    /\b(demo|reuni[óo]n|cita|llamada)\b.*\b(disponible|disponibilidad|horarios?)/i,
    /\b(qu[ée]\s+horarios?|cu[áa]ndo\s+puedes?)\b/i,
    /\b(ll[áa]mame|c[áa]game\s+una\s+llamada)/i,
    /\b(quiero\s+hablar\s+con|hablar\s+con\s+(un\s+)?humano|alguien\s+de\s+ventas)/i,
    /\bagendar\s+demo\b/i,
  ];

  return demoPatterns.some((pattern) => pattern.test(msg));
}
