export const KALYO_TOTAL_EVALUATIONS = 100;
export const KALYO_TAGLINE = 'Menos papeleo, más pacientes.';

export const STARTER_EVALUATION_SAMPLES = [
  'PHQ-9',
  'GAD-7',
  'Beck',
  'PCL-5',
  'MoCA',
  'AUDIT',
  'DASS-21',
] as const;

export const KALYO_PRICING = {
  starter: {
    name: 'Starter',
    marketing_name: 'Starter Gratuito',
    price_monthly: 0,
    price_label: 'Gratis',
    max_patients: 2,
    max_evaluations_per_month: 20,
    features: [
      '2 pacientes',
      '20 evaluaciones/mes',
      'PDF resultados básico',
      'Notas SOAP básicas',
      'Sin IA en reportes',
    ],
    not_included: [
      'Asistente de voz con IA',
      'Evaluaciones ilimitadas',
      'Reportes ejecutivos con IA',
      'Pacientes ilimitados',
    ],
  },
  pro: {
    name: 'Pro',
    marketing_name: 'Kalyo Pro',
    price_monthly: 29,
    price_label: '$29 USD/mes',
    max_patients: 'ilimitados' as const,
    max_evaluations_per_month: 'ilimitadas' as const,
    features: [
      'Pacientes ilimitados',
      `${KALYO_TOTAL_EVALUATIONS}+ evaluaciones validadas con IA`,
      'Reportes automáticos con interpretación IA',
      'Mapa de riesgo clínico / Alertas de deterioro',
      'Visualización longitudinal del progreso',
      'Notas SOAP asistidas por IA',
      'Tareas entre sesiones',
      'Resumen mensual IA por paciente',
      'Soporte prioritario',
    ],
    payment_link: 'https://buy.stripe.com/6oU5kCbIcaFS4xa7AzgQE00',
    payment_link_with_discount:
      'https://buy.stripe.com/6oU5kCbIcaFS4xa7AzgQE00?prefilled_promo_code=PRIMER50',
  },
  max: {
    name: 'Max',
    marketing_name: 'Kalyo Max',
    price_monthly: 39,
    price_label: '$39 USD/mes',
    max_patients: 'ilimitados' as const,
    features: [
      'Todo lo de Pro +',
      'Kaly — asistente clínico por voz (6 voces LATAM)',
      'Agenda integrada',
      'Kalyo Meet — videollamadas integradas',
      'Grabación + transcripción Whisper',
      'Nota SOAP / Narrativa / Literal a elección',
      'Mensajería psicólogo↔paciente',
      'Portal del paciente PWA',
      'Mood monitor con audio diario',
      'Finanzas y notas de venta PDF',
      'Confirmación citas por WhatsApp (1/2/3)',
      'Executive Summary IA en reportes',
      'Transcripción hasta 20 sesiones/mes',
    ],
    extra_features: [
      'Todo lo de Pro',
      'Kaly — asistente clínico por voz',
      'Agenda + Kalyo Meet',
      'Grabación + transcripción + SOAP',
      'Portal del paciente',
    ],
    payment_link: 'https://buy.stripe.com/dRm7sK27CbJW7Jmf31gQE01',
    payment_link_with_discount:
      'https://buy.stripe.com/dRm7sK27CbJW7Jmf31gQE01?prefilled_promo_code=PRIMER50',
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

  return (
    `📋 PLANES KALYO (precios oficiales):\n\n` +
    `💼 **${s.marketing_name}** — $0/mes\n` +
    `${s.features.map((f) => `  • ${f}`).join('\n')}\n\n` +
    `💎 **${p.marketing_name}** — $${p.price_monthly} USD/mes\n` +
    `${p.features.map((f) => `  • ${f}`).join('\n')}\n\n` +
    `🚀 **${m.marketing_name}** — $${m.price_monthly} USD/mes\n` +
    `${m.features.map((f) => `  • ${f}`).join('\n')}\n\n` +
    `Total: ${KALYO_TOTAL_EVALUATIONS}+ evaluaciones validadas disponibles.`
  );
}

export function buildStarterSummary(): string {
  const s = KALYO_PRICING.starter;
  return (
    `📋 Plan Starter Gratuito:\n\n` +
    `✓ ${s.max_patients} pacientes\n` +
    `✓ ${s.max_evaluations_per_month} evaluaciones al mes\n` +
    `✓ PDF de resultados básico\n` +
    `✓ Notas SOAP básicas\n\n` +
    `Sin tarjeta de crédito. Perfecto para probar Kalyo sin compromiso.`
  );
}

export function buildProSummary(): string {
  const p = KALYO_PRICING.pro;
  return (
    `💎 Plan Kalyo Pro — $${p.price_monthly} USD/mes:\n\n` +
    `✓ Pacientes ilimitados\n` +
    `✓ ${KALYO_TOTAL_EVALUATIONS}+ evaluaciones validadas con IA\n` +
    `✓ Reportes automáticos con interpretación IA\n` +
    `✓ Mapa de riesgo clínico\n` +
    `✓ Notas SOAP asistidas por IA\n` +
    `✓ Tareas entre sesiones\n` +
    `✓ Soporte prioritario\n\n` +
    `Menos que el costo de UNA sesión con paciente.`
  );
}

export function buildMaxSummary(): string {
  const m = KALYO_PRICING.max;
  return (
    `🚀 Plan Kalyo Max — $${m.price_monthly} USD/mes:\n\n` +
    `Todo lo de Pro +\n\n` +
    `✓ Kaly — asistente clínico por voz\n` +
    `✓ Agenda integrada\n` +
    `✓ Kalyo Meet (videollamadas)\n` +
    `✓ Grabación + transcripción de sesiones\n` +
    `✓ Nota SOAP automática\n` +
    `✓ Portal del paciente PWA\n` +
    `✓ Mood monitor\n` +
    `✓ Mensajería con pacientes\n` +
    `✓ Finanzas y notas de venta`
  );
}

export function buildKalyoOfficialPricingPrompt(): string {
  const s = KALYO_PRICING.starter;
  const p = KALYO_PRICING.pro;
  const m = KALYO_PRICING.max;
  const d = KALYO_PRICING.discount;
  const starterList = STARTER_EVALUATION_SAMPLES.join(', ');

  return `DATOS OFICIALES DE KALYO — NUNCA INVENTAR INFORMACIÓN:

PLANES:
- Starter (Gratis): ${s.max_patients} pacientes, ${s.max_evaluations_per_month} evaluaciones/mes, reportes PDF básicos, notas SOAP básicas
- Pro ($${p.price_monthly} USD/mes): pacientes ilimitados, ${KALYO_TOTAL_EVALUATIONS}+ evaluaciones con IA, reportes automáticos con IA, notas SOAP asistidas
- Max ($${m.price_monthly} USD/mes): todo lo de Pro + Kaly (voz) + Agenda + Kalyo Meet + grabación/transcripción + portal del paciente + mood monitor + mensajería

DESCUENTO ACTIVO:
- Código: ${d.code}
- Aplica: ${d.description}
- Pro con descuento: $${d.pro_with_discount} primer mes
- Max con descuento: $${d.max_with_discount} primer mes

LINKS DE PAGO OFICIALES:
- Pro: ${p.payment_link}
- Pro con descuento: ${p.payment_link_with_discount}
- Max: ${m.payment_link}
- Max con descuento: ${m.payment_link_with_discount}

REGLAS ESTRICTAS:
1. NUNCA inventes números de pacientes, evaluaciones o precios.
2. SIEMPRE usa los números exactos arriba.
3. Si dudas, repite "${KALYO_TOTAL_EVALUATIONS}+ evaluaciones" (nunca 91, 90, ni "más de 90").
4. Tagline oficial: "${KALYO_TAGLINE}"
5. Si preguntan qué tests trae Starter específicamente, lista: ${starterList} y otras evaluaciones estándar del plan gratuito.
6. NUNCA crees descuentos nuevos. El único válido es ${d.code}
7. Si no sabes un dato, di "déjame preguntar al equipo" antes de inventarlo`;
}

export function buildPlansCacheResponse(): string {
  const s = KALYO_PRICING.starter;
  const p = KALYO_PRICING.pro;
  const m = KALYO_PRICING.max;
  return (
    'Tenemos 3 planes:\n\n' +
    `• *Starter* (gratis): ${s.max_patients} pacientes activos, ${s.max_evaluations_per_month} evaluaciones/mes\n` +
    `• *Pro* (${p.price_label}): pacientes ilimitados, ${KALYO_TOTAL_EVALUATIONS}+ evaluaciones con IA, reportes IA\n` +
    `• *Max* (${m.price_label}): todo Pro + Kaly voz + Meet + transcripción + portal paciente\n\n` +
    '¿Quieres probar Pro 15 días gratis?'
  );
}
