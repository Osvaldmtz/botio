/** Official count from kalyo.io / app.kalyo.io/pricing (91+ tests clínicos validados). */
export const KALYO_TOTAL_EVALUATIONS = 91;
export const KALYO_TAGLINE = 'Menos papeleo, más pacientes.';

export const STARTER_EVALUATION_SAMPLES = ['PHQ-9', 'GAD-7', 'BDI'] as const;

export const KALYO_PRICING = {
  starter: {
    name: 'Starter',
    marketing_name: 'Starter',
    price_monthly: 0,
    price_label: 'Gratis',
    max_patients: 2,
    max_evaluations_per_month: 10,
    features: [
      'Hasta 2 pacientes activos',
      '10 evaluaciones/mes',
      '3 pruebas básicas (PHQ-9, GAD-7, BDI)',
      '1 plantilla personalizada',
      'Reportes básicos',
      'Consentimientos básicos',
      'PDF con marca de agua Kalyo',
      'Soporte comunidad',
    ],
    not_included: [
      'Pacientes ilimitados',
      'Evaluaciones ilimitadas',
      'Kaly Voice',
      'Agenda y videollamadas',
      'Reportes IA avanzados',
    ],
  },
  pro: {
    name: 'Pro',
    marketing_name: 'Pro',
    price_monthly: 29,
    price_label: '$29 USD/mes',
    max_patients: 'ilimitados' as const,
    max_evaluations_per_month: 'ilimitadas' as const,
    features: [
      'Pacientes ilimitados',
      'Evaluaciones ilimitadas',
      '91+ tests clínicos validados',
      'Plantillas ilimitadas',
      'Kaly Voice (asistente de voz)',
      'Reportes IA avanzados',
      'Copilot terapéutico',
      'Resumen mensual IA',
      'Daily Brief',
      'PDF con branding propio',
      'Google Calendar sync',
      'Cuestionarios personalizados',
      'Importación CSV/Excel',
      'Soporte prioritario',
    ],
    payment_link: 'https://buy.stripe.com/6oU5kCbIcaFS4xa7AzgQE00',
    payment_link_with_discount:
      'https://buy.stripe.com/6oU5kCbIcaFS4xa7AzgQE00?prefilled_promo_code=PRIMER50',
  },
  max: {
    name: 'Max',
    marketing_name: 'Max',
    price_monthly: 39,
    price_label: '$39 USD/mes',
    max_patients: 'ilimitados' as const,
    recommended: true,
    features: [
      'Todo lo de Pro +',
      'Agenda de citas integrada',
      'Videollamadas con Daily.co',
      'Grabación + transcripción (20/mes)',
      'SOAP + IA (estructuración)',
      'Tareas para pacientes',
      'Portal del paciente',
      'Finanzas y facturación',
      'Facturación SAT México (CFDI 4.0)',
      'Mensajería psicólogo↔paciente',
      'Monitor de ánimo',
      'Disponibilidad configurable',
      'Detección de deterioro clínico',
      'Distorsiones cognitivas',
      'Recordatorios WhatsApp automáticos',
    ],
    highlight_features: [
      'Agenda + videollamadas',
      'Grabación y transcripción',
      'Portal del paciente',
      'Recordatorios WhatsApp',
    ],
    payment_link: 'https://buy.stripe.com/dRm7sK27CbJW7Jmf31gQE01',
    payment_link_with_discount:
      'https://buy.stripe.com/dRm7sK27CbJW7Jmf31gQE01?prefilled_promo_code=PRIMER50',
  },
  ultra: {
    name: 'Ultra',
    marketing_name: 'Ultra',
    price_monthly: 69,
    price_label: '$69 USD/mes',
    features: [
      'Todo lo de Max +',
      'Sofía: asistente IA por WhatsApp 24/7',
      'Agendamiento automático por WhatsApp',
      'Inbox de supervisión con handoff',
      'FAQs configurables del consultorio',
      'Notificaciones al psicólogo en tiempo real',
      'Disponibilidad y bloqueos respetados por Sofía',
      'Número de WhatsApp Business propio',
      'Cobro con tarjeta desde WhatsApp',
    ],
  },
  discount: {
    code: 'PRIMER50',
    description: '50% descuento primer mes',
    pro_with_discount: 14.5,
    max_with_discount: 19.5,
  },
} as const;

export function buildPricingSummary(): string {
  const s = KALYO_PRICING.starter;
  const p = KALYO_PRICING.pro;
  const m = KALYO_PRICING.max;
  const u = KALYO_PRICING.ultra;

  return (
    `📋 PLANES KALYO (precios oficiales — SSOT kalyo.io / app.kalyo.io/pricing):\n\n` +
    `🚀 **${m.marketing_name}** — $${m.price_monthly} USD/mes (recomendado)\n` +
    `${m.features.map((f) => `  • ${f}`).join('\n')}\n\n` +
    `💎 **${p.marketing_name}** — $${p.price_monthly} USD/mes\n` +
    `${p.features.map((f) => `  • ${f}`).join('\n')}\n\n` +
    `⭐ **${u.marketing_name}** — $${u.price_monthly} USD/mes (premium)\n` +
    `${u.features.map((f) => `  • ${f}`).join('\n')}\n\n` +
    `🆓 **${s.marketing_name}** — $0/mes\n` +
    `${s.features.map((f) => `  • ${f}`).join('\n')}`
  );
}

export function buildStarterSummary(): string {
  const s = KALYO_PRICING.starter;
  return (
    `📋 Plan Starter — Gratis:\n\n` +
    `✓ ${s.max_patients} pacientes activos\n` +
    `✓ ${s.max_evaluations_per_month} evaluaciones/mes\n` +
    `✓ 3 pruebas básicas (PHQ-9, GAD-7, BDI)\n` +
    `✓ Reportes básicos y consentimientos\n\n` +
    `Sin tarjeta de crédito. Ideal si quieres empezar sin compromiso.`
  );
}

export function buildProSummary(): string {
  const p = KALYO_PRICING.pro;
  return (
    `💎 Plan Pro — $${p.price_monthly} USD/mes:\n\n` +
    `✓ Pacientes y evaluaciones ilimitadas\n` +
    `✓ 91+ tests clínicos validados\n` +
    `✓ Kaly Voice (asistente de voz)\n` +
    `✓ Reportes IA avanzados + Copilot terapéutico\n` +
    `✓ Resumen mensual IA y Daily Brief\n` +
    `✓ Soporte prioritario\n\n` +
    `Alternativa más básica si no necesitas agenda ni videollamadas.`
  );
}

export function buildMaxSummary(): string {
  const m = KALYO_PRICING.max;
  return (
    `🚀 Plan Max — $${m.price_monthly} USD/mes (recomendado):\n\n` +
    `Todo lo de Pro +\n\n` +
    `✓ Agenda de citas integrada\n` +
    `✓ Videollamadas con Daily.co\n` +
    `✓ Grabación + transcripción (20/mes)\n` +
    `✓ SOAP + IA, portal del paciente\n` +
    `✓ Finanzas, facturación SAT y recordatorios WhatsApp`
  );
}

export function buildUltraSummary(): string {
  const u = KALYO_PRICING.ultra;
  const m = KALYO_PRICING.max;
  return (
    `⭐ Plan Ultra — $${u.price_monthly} USD/mes:\n\n` +
    `Todo lo de Max +\n\n` +
    `✓ Sofía asistente IA por WhatsApp 24/7\n` +
    `✓ Agendamiento automático por WhatsApp\n` +
    `✓ Inbox de supervisión con handoff\n` +
    `✓ Número WhatsApp Business propio\n` +
    `✓ Cobro con tarjeta desde WhatsApp\n\n` +
    `Comparado con Max ($${m.price_monthly}/mes): Ultra automatiza tu consultorio fuera de horario con Sofía.`
  );
}

export function buildStandardPricePresentation(): string {
  const p = KALYO_PRICING.pro;
  const m = KALYO_PRICING.max;
  const d = KALYO_PRICING.discount;
  const maxLink = m.payment_link_with_discount;

  const maxBullets = m.highlight_features.map((f) => `• ${f}`).join('\n');
  const proBullets = [
    'Pacientes y evaluaciones ilimitadas',
    '91+ tests clínicos validados',
    'Kaly Voice + reportes IA avanzados',
    'Copilot terapéutico y soporte prioritario',
  ]
    .map((f) => `• ${f}`)
    .join('\n');

  return (
    `Nuestros planes:\n\n` +
    `🚀 *Max — $${m.price_monthly}/mes* (recomendado)\n` +
    `${maxBullets}\n` +
    `+ todo lo de Pro (evaluaciones ilimitadas, Kaly Voice, reportes IA)\n\n` +
    `💎 *Pro — $${p.price_monthly}/mes*\n` +
    `${proBullets}\n\n` +
    `*Kaly puede activar Max con 50% off el primer mes: $${d.max_with_discount} con cupón ${d.code}.*\n` +
    `${maxLink}\n\n` +
    `¿Cuál te interesa?`
  );
}

export function buildPlansCacheResponse(): string {
  return buildStandardPricePresentation();
}

export function buildKalyoOfficialPricingPrompt(): string {
  const s = KALYO_PRICING.starter;
  const p = KALYO_PRICING.pro;
  const m = KALYO_PRICING.max;
  const u = KALYO_PRICING.ultra;
  const d = KALYO_PRICING.discount;
  const starterList = STARTER_EVALUATION_SAMPLES.join(', ');

  return `DATOS OFICIALES DE KALYO — SSOT: kalyo.io y app.kalyo.io/pricing. NUNCA INVENTAR INFORMACIÓN.

PLANES DE KALYO:
- Starter (Gratis): ${s.max_patients} pacientes activos, ${s.max_evaluations_per_month} evaluaciones/mes, 3 pruebas básicas (${starterList}), reportes básicos, PDF con marca de agua
- Pro ($${p.price_monthly} USD/mes): pacientes ilimitados, evaluaciones ilimitadas, 91+ tests, Kaly Voice, reportes IA avanzados, copilot, resumen mensual IA, Daily Brief, soporte prioritario
- Max ($${m.price_monthly} USD/mes) — RECOMENDADO: todo Pro + agenda, videollamadas Daily.co, grabación/transcripción (20/mes), SOAP+IA, portal paciente, finanzas, facturación SAT, recordatorios WhatsApp
- Ultra ($${u.price_monthly} USD/mes): todo Max + Sofía WhatsApp 24/7, agendamiento automático, inbox supervisión, número WhatsApp Business propio, cobro con tarjeta

ESTRATEGIA DE VENTA (OBLIGATORIA):
1. Siempre presenta Max PRIMERO como plan recomendado.
2. Pro = alternativa "más básica" (sin agenda ni videollamadas).
3. Ultra = solo si preguntan por más features premium o automatización con Sofía.
4. Starter = solo si insisten en gratuito o no pueden pagar aún.
5. Formato estándar al preguntar precio: usa el bloque "PRESENTACIÓN ESTÁNDAR DE PRECIOS" abajo.

PRESENTACIÓN ESTÁNDAR DE PRECIOS (cuando pregunten cuánto cuesta / precio / planes):
${buildStandardPricePresentation()}

OBJECIONES DE PRECIO:
- "Es caro" → primero ofrece Max con cupón ${d.code} ($${d.max_with_discount} primer mes). NO bajes automático a Pro.
- Si aún rechaza → ofrece Pro con ${d.code} ($${d.pro_with_discount} primer mes).
- Si dice "prefiero Pro" → NO forzar. Menciona UNA sola vez: "Con $10 más tienes agenda + videollamadas + transcripción de sesiones. ¿Seguro?" Si insiste, activa Pro sin más drama.
- Si preguntan por Ultra → muestra features Ultra, precio $${u.price_monthly}/mes y comparación breve con Max.

DESCUENTO ACTIVO:
- Código: ${d.code}
- Aplica: ${d.description}
- Pro con descuento: $${d.pro_with_discount} primer mes
- Max con descuento: $${d.max_with_discount} primer mes

LINKS DE PAGO OFICIALES (default: Max con ${d.code}):
- Max con descuento (DEFAULT): ${m.payment_link_with_discount}
- Max sin descuento: ${m.payment_link}
- Pro con descuento: ${p.payment_link_with_discount}
- Pro sin descuento: ${p.payment_link}
- Ultra: derivar a hola@kalyo.io o app.kalyo.io/pricing (sin link Stripe directo)

REGLAS ESTRICTAS:
1. NUNCA inventes números de pacientes, evaluaciones o precios.
2. SIEMPRE usa los números exactos arriba.
3. Si dudas sobre evaluaciones, di "91+ tests clínicos validados" (nunca 100, 90, ni otro número).
4. Tagline oficial: "${KALYO_TAGLINE}"
5. Kaly Voice está en Pro; agenda/videollamadas/transcripción están en Max.
6. NUNCA crees descuentos nuevos. El único válido es ${d.code}
7. Si no sabes un dato, di "déjame preguntar al equipo" antes de inventarlo`;
}
