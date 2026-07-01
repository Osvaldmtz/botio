export const PRO_PRICE_USD = 29;
export const MAX_PRICE_USD = 39;
export const DEFAULT_CAC_USD = 68.52;
export const MXN_PER_USD = 17.5;

export type LtvDerived = {
  avg_mrr_per_subscriber: number;
  avg_ltv_months: number | null;
  avg_ltv_months_label: string;
  ltv_pro: number;
  ltv_max: number;
  ltv_avg: number;
  ltv_cac_ratio: number | null;
  cac_usd: number | null;
  payback_months: number | null;
};

export function computeLtvCacRatio(
  ltvAvg: number,
  cacUsd: number | null | undefined,
): number | null {
  if (cacUsd == null || cacUsd <= 0 || ltvAvg <= 0) return null;
  return ltvAvg / cacUsd;
}

export function computeAvgLtvMonths(churnRate: number): number | null {
  if (churnRate <= 0) return null;
  return 100 / churnRate;
}

export function formatLtvMonthsLabel(churnRate: number): string {
  if (churnRate <= 0) return '>24 meses (sin churn)';
  const months = computeAvgLtvMonths(churnRate)!;
  return `${months.toFixed(1)} meses`;
}

/** Numeric months used for LTV math — uses 24 when churn is zero. */
export function ltvMonthsForCalc(churnRate: number): number {
  return churnRate > 0 ? 100 / churnRate : 24;
}

export function computeLtvDerived(input: {
  mrr: number;
  active_subscribers: number;
  churn_rate: number;
  cac_usd?: number | null;
  /** When true and cac_usd is missing, falls back to DEFAULT_CAC_USD (legacy UI only). */
  fallbackDefaultCac?: boolean;
}): LtvDerived {
  const subs = input.active_subscribers;
  const avg_mrr_per_subscriber = subs > 0 ? input.mrr / subs : 0;
  const avg_ltv_months = computeAvgLtvMonths(input.churn_rate);
  const months = ltvMonthsForCalc(input.churn_rate);
  const ltv_pro = months * PRO_PRICE_USD;
  const ltv_max = months * MAX_PRICE_USD;
  const ltv_avg = months * avg_mrr_per_subscriber;
  const cac_usd =
    input.cac_usd != null
      ? input.cac_usd
      : input.fallbackDefaultCac
        ? DEFAULT_CAC_USD
        : null;
  const ltv_cac_ratio = computeLtvCacRatio(ltv_avg, cac_usd);
  const payback_months =
    cac_usd != null && avg_mrr_per_subscriber > 0
      ? cac_usd / avg_mrr_per_subscriber
      : null;

  return {
    avg_mrr_per_subscriber,
    avg_ltv_months,
    avg_ltv_months_label: formatLtvMonthsLabel(input.churn_rate),
    ltv_pro,
    ltv_max,
    ltv_avg,
    ltv_cac_ratio,
    cac_usd,
    payback_months,
  };
}

export type LtvCacHealth = {
  label: string;
  tone: 'excellent' | 'healthy' | 'attention' | 'critical' | 'unknown';
  colorClass: string;
  bgClass: string;
};

export function getLtvCacHealth(ratio: number | null | undefined): LtvCacHealth {
  if (ratio == null || Number.isNaN(ratio) || ratio <= 0) {
    return {
      label: 'Sin datos',
      tone: 'unknown',
      colorClass: 'text-fg-muted',
      bgClass: 'border-bg-border bg-bg-subtle',
    };
  }
  if (ratio > 5) {
    return {
      label: 'Excelente',
      tone: 'excellent',
      colorClass: 'text-emerald-700',
      bgClass: 'border-emerald-200 bg-emerald-50',
    };
  }
  if (ratio >= 3) {
    return {
      label: 'Saludable',
      tone: 'healthy',
      colorClass: 'text-emerald-600',
      bgClass: 'border-emerald-200 bg-emerald-50/80',
    };
  }
  if (ratio >= 1) {
    return {
      label: 'Atención',
      tone: 'attention',
      colorClass: 'text-amber-700',
      bgClass: 'border-amber-200 bg-amber-50',
    };
  }
  return {
    label: 'Crítico',
    tone: 'critical',
    colorClass: 'text-rose-700',
    bgClass: 'border-rose-200 bg-rose-50',
  };
}

export function getLtvCacRatioCardHealth(ratio: number | null | undefined): {
  accent: 'emerald' | 'amber' | 'rose';
  hint: string;
} {
  if (ratio == null || Number.isNaN(ratio) || ratio <= 0) {
    return { accent: 'amber', hint: 'Sin adquisiciones en ventana 30d' };
  }
  if (ratio > 3) return { accent: 'emerald', hint: 'Objetivo SaaS: >3x (30d)' };
  if (ratio >= 1) return { accent: 'amber', hint: 'Por debajo del objetivo 3x (30d)' };
  return { accent: 'rose', hint: 'LTV menor que CAC (30d)' };
}

export function formatLtvCacRatio(ratio: number | null | undefined): string {
  if (ratio == null || Number.isNaN(ratio) || ratio <= 0) return '—';
  return `${ratio.toFixed(1)}x`;
}
