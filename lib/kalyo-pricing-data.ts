export const KALYO_PRICING = {
  starter: {
    name: 'Starter',
    price_monthly: 0,
    price_label: 'Gratis',
    max_patients: 2,
    max_evaluations_per_month: 20,
    features: [
      '2 pacientes activos',
      '20 evaluaciones por mes',
      'Reportes en PDF',
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
    price_monthly: 29,
    price_label: '$29 USD/mes',
    max_patients: 'ilimitados' as const,
    max_evaluations_per_month: 'ilimitadas' as const,
    features: [
      'Pacientes ilimitados',
      'Evaluaciones ilimitadas',
      '+100 tests clínicos validados',
      'Reportes ejecutivos con IA',
      'Calificación automática con IA',
      'Interpretación DSM-5',
    ],
    payment_link: 'https://buy.stripe.com/6oU5kCbIcaFS4xa7AzgQE00',
    payment_link_with_discount:
      'https://buy.stripe.com/6oU5kCbIcaFS4xa7AzgQE00?prefilled_promo_code=PRIMER50',
  },
  max: {
    name: 'Max',
    price_monthly: 39,
    price_label: '$39 USD/mes',
    max_patients: 'ilimitados' as const,
    extra_features: [
      'Todo lo de Pro',
      'Asistente de voz con IA',
      'Resumen ejecutivo automático',
      'Soporte prioritario',
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

export function buildKalyoOfficialPricingPrompt(): string {
  const s = KALYO_PRICING.starter;
  const p = KALYO_PRICING.pro;
  const m = KALYO_PRICING.max;
  const d = KALYO_PRICING.discount;

  return `DATOS OFICIALES DE KALYO — NUNCA INVENTAR INFORMACIÓN:

PLANES:
- Starter (Gratis): ${s.max_patients} pacientes, ${s.max_evaluations_per_month} evaluaciones/mes, reportes PDF
- Pro ($${p.price_monthly} USD/mes): pacientes ilimitados, evaluaciones ilimitadas, reportes con IA, DSM-5
- Max ($${m.price_monthly} USD/mes): todo lo de Pro + asistente de voz IA + soporte prioritario

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

REGLAS ABSOLUTAS:
1. NUNCA inventes cifras de pacientes/evaluaciones diferentes a las oficiales
2. NUNCA crees descuentos nuevos. El único válido es ${d.code}
3. NUNCA inventes features que no estén listadas arriba
4. Si no sabes un dato, di "déjame preguntar al equipo" antes de inventarlo`;
}

export function buildStarterSummary(): string {
  const s = KALYO_PRICING.starter;
  return `${s.max_patients} pacientes activos, ${s.max_evaluations_per_month} evaluaciones/mes`;
}

export function buildPlansCacheResponse(): string {
  const s = KALYO_PRICING.starter;
  const p = KALYO_PRICING.pro;
  const m = KALYO_PRICING.max;
  return (
    'Tenemos 3 planes:\n\n' +
    `• *Starter* (gratis): ${s.max_patients} pacientes activos, ${s.max_evaluations_per_month} evaluaciones/mes\n` +
    `• *Pro* (${p.price_label}): pacientes ilimitados, evaluaciones ilimitadas, reportes IA\n` +
    `• *Max* (${m.price_label}): todo Pro + asistente de voz IA + soporte prioritario\n\n` +
    '¿Quieres probar Pro 15 días gratis?'
  );
}
