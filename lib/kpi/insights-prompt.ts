import type { KpiInsightsData } from '@/lib/kpi/insights-types';
import {
  DEFAULT_CAC_USD,
  MXN_PER_USD,
  computeLtvDerived,
  formatLtvMonthsLabel,
} from '@/lib/kpi/ltv-utils';

export const KPI_ANALYSIS_SYSTEM_PROMPT =
  'Eres un estratega de marketing digital y growth specialist especializado en SaaS B2B para salud mental en Latinoamérica. Analizas los KPIs de Kalyo, una plataforma para psicólogos clínicos. Sé directo, específico y usa los números reales en cada insight. No des recomendaciones genéricas.';

function fmtNum(value: number | null | undefined, decimals = 0): string {
  if (value == null || Number.isNaN(value)) return 'N/D';
  return value.toLocaleString('es-MX', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function fmtMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'N/D';
  return value.toLocaleString('es-MX', { style: 'currency', currency: 'USD' });
}

function fmtMxn(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'N/D';
  return `$${fmtNum(value, 2)} MXN`;
}

export function buildKpiAnalysisPrompt(data: KpiInsightsData): string {
  const { kalyo, twilio, instagram, metaAds, ga4Landing, ga4App, clarity } = data;

  const spendMxn = metaAds.spend;
  const spendUsdEquiv = spendMxn / MXN_PER_USD;
  const subscribers = kalyo.active_subscribers ?? 0;
  const mrr = Number(kalyo.mrr ?? 0);
  const churnRate = Number(kalyo.churn_rate ?? 0);

  const ltv = computeLtvDerived({
    mrr,
    active_subscribers: subscribers,
    churn_rate: churnRate,
    cac_usd:
      subscribers > 0 && spendMxn > 0
        ? spendUsdEquiv / subscribers
        : DEFAULT_CAC_USD,
  });

  const ltvAvg = kalyo.ltv_avg != null ? Number(kalyo.ltv_avg) : ltv.ltv_avg;
  const ltvCacRatio =
    kalyo.ltv_cac_ratio != null ? Number(kalyo.ltv_cac_ratio) : ltv.ltv_cac_ratio;
  const cacUsd = ltv.cac_usd;
  const payback =
    ltv.payback_months != null ? ltv.payback_months.toFixed(1) : 'N/D';

  const metaCurrency = metaAds.currency ?? 'MXN';

  const saasContext = `CONTEXTO DE NEGOCIO CRÍTICO — LEER ANTES DE ANALIZAR:
Kalyo es un SaaS B2B de suscripción mensual para psicólogos clínicos en LATAM.
Cada suscriptor representa ingresos RECURRENTES, no una venta única.

Métricas de valor de largo plazo:
- Plan Pro: $29 USD/mes | Plan Max: $39 USD/mes
- LTV promedio actual: ${fmtMoney(ltvAvg)} (basado en churn rate de ${fmtNum(churnRate, 1)}%)
- Ratio LTV:CAC actual: ${fmtNum(ltvCacRatio, 1)}x
- CAC actual: ~${fmtMoney(cacUsd)} (Meta Ads MXN convertido)
- Payback period: ~${payback} meses

REGLA DE INTERPRETACIÓN: Un CAC de ${fmtMoney(cacUsd)} es SALUDABLE si el LTV supera $200 USD (ratio 3x mínimo). Con churn bajo, cada suscriptor puede valer $500-800 USD en ingresos totales. NO recomendar pausar ads basándose solo en MRR mensual vs gasto mensual — evaluar siempre en términos de LTV vs CAC.

Al analizar ROI de Meta Ads: comparar CAC (${fmtMoney(cacUsd)}) contra LTV (${fmtMoney(ltvAvg)}), no contra MRR mensual (${fmtMoney(subscribers > 0 ? mrr / subscribers : null)}/suscriptor). El negocio es rentable si LTV:CAC > 3x.`;

  return `${saasContext}

Analiza estos KPIs de Kalyo y dame insights accionables:

NEGOCIO:
- MRR: ${fmtMoney(kalyo.mrr)} | Suscriptores activos: ${fmtNum(kalyo.active_subscribers)} (Pro: ${fmtNum(kalyo.plan_pro)}, Max: ${fmtNum(kalyo.plan_max)}) | Trials: ${fmtNum(kalyo.trialing)}
- Churn 30d: ${fmtNum(kalyo.churned_30d)} cancelaciones | Churn rate: ${fmtNum(churnRate, 1)}% | Vida útil prom.: ${formatLtvMonthsLabel(churnRate)}

WHATSAPP (últimos 30 días):
- Mensajes enviados: ${fmtNum(twilio.total_sent)} | Tasa entrega: ${fmtNum(twilio.delivery_rate, 1)}% | Fallidos: ${fmtNum(twilio.failed)} | Costo: ${fmtMoney(twilio.total_cost_usd)}

INSTAGRAM @kalyo_app:
- Seguidores: ${fmtNum(instagram.followers)} | Reach 7d: ${fmtNum(instagram.reach_7d)} | Impresiones 7d: ${fmtNum(instagram.impressions_7d)} | Engagement: ${fmtNum(instagram.engagement_rate, 1)}%

META ADS:
IMPORTANTE: El gasto de Meta Ads está en pesos mexicanos (${metaCurrency}). La cuenta opera en México. Para comparar con MRR en USD usar tipo de cambio ~${MXN_PER_USD} MXN/USD. Gasto equivalente en USD: ~${fmtMoney(spendUsdEquiv)}.
- Gasto 30d: ${fmtMxn(spendMxn)} | Impresiones: ${fmtNum(metaAds.impressions)} | Clicks: ${fmtNum(metaAds.clicks)} | CTR: ${fmtNum(metaAds.ctr, 2)}%
- CAC en MXN: ${subscribers > 0 ? `${fmtMxn(spendMxn / subscribers)} por suscriptor` : 'N/D'} (~${subscribers > 0 ? `${fmtMoney(spendUsdEquiv / subscribers)} USD` : 'N/D'} por suscriptor)
- ROI real (LTV basis): cada ${fmtMoney(cacUsd)} invertidos genera ~${fmtMoney(ltvAvg)} de valor total = ${fmtNum(ltvCacRatio, 1)}x ROI

WEB — kalyo.io (landing):
- Usuarios 30d: ${fmtNum(ga4Landing.users)} | Sesiones: ${fmtNum(ga4Landing.sessions)} | Engagement: ${fmtNum(ga4Landing.engagement_rate, 1)}% | Bounce: ${fmtNum(ga4Landing.bounce_rate, 1)}%

WEB — app.kalyo.io:
- Usuarios 20d: ${fmtNum(ga4App.users)} | Sesiones: ${fmtNum(ga4App.sessions)} | Engagement: ${fmtNum(ga4App.engagement_rate, 1)}% | Duración promedio: ${fmtNum(ga4App.avg_duration_min, 1)} min

${
  clarity
    ? `COMPORTAMIENTO DE USUARIO — Microsoft Clarity (últimos 3 días):
- Sesiones reales: ${fmtNum(clarity.realSessions)} (bots excluidos: ${fmtNum(clarity.botSessions)}, ${fmtNum(clarity.botRate, 1)}% del tráfico)
- Scroll depth promedio: ${fmtNum(clarity.scrollDepth, 1)}%
- Tiempo activo promedio: ${fmtNum(clarity.activeTimeSec)} seg
- Quick backs: ${fmtNum(clarity.quickBacks, 1)}% (usuario vuelve atrás rápido = contenido no relevante)
- Rage clicks: ${fmtNum(clarity.rageClicks, 1)}% (frustración con elementos no clickeables)
- Dead clicks: ${fmtNum(clarity.deadClicks, 1)}% (clicks en zonas sin respuesta)`
    : 'COMPORTAMIENTO DE USUARIO — Microsoft Clarity: N/D (API no disponible)'
}

Responde en este formato exacto con estas 4 secciones:

## ✅ Lo que está funcionando
[3-4 bullets con números reales, qué métricas son positivas y por qué importan]

## ⚠️ Alertas y problemas detectados
[3-4 bullets con los problemas más urgentes basados en los datos]

## 🎯 Top 3 acciones esta semana
[Exactamente 3 acciones concretas, ordenadas por impacto, con el número/métrica que justifica cada una]

## 📈 Proyección a 30 días
[Si ejecutas las 3 acciones anteriores, qué métricas podrían mejorar y a qué valores estimados]`;
}
