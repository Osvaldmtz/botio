import { KALYO_PRICING } from '@/lib/kalyo-pricing-data';

/** Minimal FX shape for sales prompt injection (from getUsdFxRates). */
export type FxRatesForPrompt = {
  mxn_per_usd: number;
  cop_per_usd: number;
  source: string;
  fetched_at: string;
};

export type LocalCurrencyFocus = 'mxn' | 'cop' | 'both';

/**
 * Detecta si el usuario pide equivalencia en moneda local / tipo de cambio.
 * No incluye preguntas genéricas de precio en USD.
 */
export function isLocalCurrencyQuestion(messageBody: string): boolean {
  return (
    /pesos|mxn|\bcop\b|trm|tipo\s+de\s+cambio|equival[ea]|moneda\s+local|en\s+(mxn|cop|ars|pen|clp)|a\s+cu[aá]nto\s+(equivale|est[aá])|cu[aá]nto\s+(es|ser[ií]a|queda|sale|costar[ií]a)\s+en|d[oó]lares?\s+a\s+pesos|usd\s+a\s+|valor\s+es\s+en\s+pesos|es\s+en\s+pesos|precio\s+es\s+en\s+pesos/i.test(
      messageBody,
    )
  );
}

export function detectLocalCurrencyFocus(
  messageBody: string,
  country?: string | null,
): LocalCurrencyFocus {
  const t = messageBody.toLowerCase();
  if (/mexican|mxn|\bmx\b/.test(t)) return 'mxn';
  if (/colombian|cop|\btrm\b/.test(t)) return 'cop';
  if (country === 'México') return 'mxn';
  if (country === 'Colombia') return 'cop';
  return 'both';
}

function fmtMxn(n: number): string {
  return `$${Math.round(n).toLocaleString('es-MX')} MXN`;
}

function fmtCop(n: number): string {
  return `$${Math.round(n).toLocaleString('es-CO')} COP`;
}

/**
 * Bloque de system prompt con tipo de cambio live para que Sofía no invente tasas.
 */
export function buildLocalCurrencyFxPrompt(
  fx: FxRatesForPrompt,
  opts?: { country?: string | null; messageBody?: string },
): string {
  const focus = detectLocalCurrencyFocus(opts?.messageBody ?? '', opts?.country);
  const pro = KALYO_PRICING.pro.price_monthly;
  const max = KALYO_PRICING.max.price_monthly;

  const proMxn = pro * fx.mxn_per_usd;
  const maxMxn = max * fx.mxn_per_usd;
  const proCop = pro * fx.cop_per_usd;
  const maxCop = max * fx.cop_per_usd;

  const mxnLine =
    `- 1 USD ≈ ${fx.mxn_per_usd.toFixed(2)} MXN\n` +
    `- Pro $${pro} ≈ ${fmtMxn(proMxn)}/mes\n` +
    `- Max $${max} ≈ ${fmtMxn(maxMxn)}/mes`;

  const copLine =
    `- 1 USD ≈ ${fx.cop_per_usd.toFixed(2)} COP (TRM)\n` +
    `- Pro $${pro} ≈ ${fmtCop(proCop)}/mes\n` +
    `- Max $${max} ≈ ${fmtCop(maxCop)}/mes`;

  let ratesBlock: string;
  if (focus === 'mxn') {
    ratesBlock = `PRIORIZA MXN (México):\n${mxnLine}\n\nReferencia COP (solo si preguntan):\n${copLine}`;
  } else if (focus === 'cop') {
    ratesBlock = `PRIORIZA COP (Colombia):\n${copLine}\n\nReferencia MXN (solo si preguntan):\n${mxnLine}`;
  } else {
    ratesBlock = `MXN:\n${mxnLine}\n\nCOP:\n${copLine}`;
  }

  const countryNote = opts?.country
    ? `País detectado del lead: ${opts.country}. Prioriza esa moneda si el mensaje no especifica otra.`
    : 'Si el usuario no indica país, pregunta o usa la moneda que mencione.';

  const fetched = fx.fetched_at
    ? new Date(fx.fetched_at).toISOString().slice(0, 10)
    : 'hoy';

  return `TIPO DE CAMBIO ACTUAL (fuente live, actualizado ${fetched}, source=${fx.source}) — USA SOLO ESTOS NÚMEROS.

${ratesBlock}

${countryNote}

REGLAS OBLIGATORIAS:
1. NUNCA inventes tipos de cambio de tu conocimiento ni uses tasas memorizadas antiguas; usa ÚNICAMENTE las cifras de este bloque.
2. Di que es una equivalencia aproximada; el cobro final lo define el banco/Stripe el día del pago.
3. Los planes oficiales siguen en USD; la conversión es solo para orientar.
4. Tras dar la equivalencia, redirige a prueba gratis de Max (7 días sin tarjeta) cuando encaje.`;
}
