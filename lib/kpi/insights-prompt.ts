import type { KpiInsightsData } from '@/lib/kpi/insights-types';
import {
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

function shortenSearchConsolePage(url: string): string {
  try {
    const path = new URL(url).pathname;
    if (path.startsWith('/articulos/')) return path;
    return path || url;
  } catch {
    return url;
  }
}

export function buildKpiAnalysisPrompt(data: KpiInsightsData): string {
  const { kalyo, twilio, instagram, metaAds, ga4Landing, ga4App, clarity, searchConsole, searchConsoleEmpty } =
    data;

  const spendMxn = metaAds.spend;
  const spendUsdEquiv = spendMxn / MXN_PER_USD;
  const subscribers = kalyo.active_subscribers ?? 0;
  const mrr = Number(kalyo.mrr ?? 0);
  const churnRate = Number(kalyo.churn_rate ?? 0);

  const ltv = computeLtvDerived({
    mrr,
    active_subscribers: subscribers,
    churn_rate: churnRate,
    cac_usd: kalyo.cac_usd,
  });

  const ltvAvg = kalyo.ltv_avg != null ? Number(kalyo.ltv_avg) : ltv.ltv_avg;
  const ltvCacRatio =
    kalyo.ltv_cac_ratio != null ? Number(kalyo.ltv_cac_ratio) : ltv.ltv_cac_ratio;
  const ltvCacRatioAlltime =
    kalyo.ltv_cac_ratio_alltime != null ? Number(kalyo.ltv_cac_ratio_alltime) : null;
  const cacUsd = kalyo.cac_usd != null ? Number(kalyo.cac_usd) : ltv.cac_usd;
  const cacUsdAlltime =
    kalyo.cac_usd_alltime != null ? Number(kalyo.cac_usd_alltime) : null;
  const newSubs30d = kalyo.new_subscribers_30d ?? null;
  const totalPayingCustomers = kalyo.total_paying_customers ?? null;
  const payback =
    ltv.payback_months != null ? ltv.payback_months.toFixed(1) : 'N/D';

  const metaCurrency = metaAds.currency ?? 'MXN';

  const saasContext = `CONTEXTO DE NEGOCIO CRÍTICO — LEER ANTES DE ANALIZAR:
Kalyo es un SaaS B2B de suscripción mensual para psicólogos clínicos en LATAM.
Cada suscriptor representa ingresos RECURRENTES, no una venta única.

Métricas de valor de largo plazo:
- Plan Pro: $29 USD/mes | Plan Max: $39 USD/mes
- LTV promedio actual: ${fmtMoney(ltvAvg)} (basado en churn rate de ${fmtNum(churnRate, 1)}%)
- Ratio LTV:CAC (30d, primario): ${fmtNum(ltvCacRatio, 1)}x
- Ratio LTV:CAC (all-time): ${ltvCacRatioAlltime != null ? `${fmtNum(ltvCacRatioAlltime, 1)}x` : 'N/D'}
- CAC 30d: ~${fmtMoney(cacUsd)} (gasto Meta 30d / clientes nuevos 30d: ${fmtNum(newSubs30d)})
- CAC histórico: ~${fmtMoney(cacUsdAlltime)} (gasto Meta total / ${fmtNum(totalPayingCustomers)} clientes de por vida)
- Payback period: ~${payback} meses

REGLA DE INTERPRETACIÓN: Usa SIEMPRE el ratio LTV:CAC (30d) como métrica primaria de decisión operativa. El ratio all-time es contexto histórico y puede inflarse si el denominador incluye toda la base acumulada. Un CAC 30d de ${fmtMoney(cacUsd)} es saludable si LTV:CAC (30d) supera 3x. NO recomendar pausar ads basándose solo en MRR mensual vs gasto mensual — evaluar siempre en términos de LTV vs CAC (30d).

Al analizar ROI de Meta Ads: comparar CAC 30d (${fmtMoney(cacUsd)}) contra LTV (${fmtMoney(ltvAvg)}), no contra MRR mensual (${fmtMoney(subscribers > 0 ? mrr / subscribers : null)}/suscriptor). El negocio es rentable si LTV:CAC (30d) > 3x.`;

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
- CAC 30d: ${newSubs30d != null && newSubs30d > 0 ? `${fmtMxn(spendMxn / newSubs30d)} por cliente nuevo (${fmtNum(newSubs30d)} en 30d)` : 'N/D'} (~${fmtMoney(cacUsd)} USD)
- ROI real (LTV basis, 30d): cada ${fmtMoney(cacUsd)} invertidos genera ~${fmtMoney(ltvAvg)} de valor total = ${fmtNum(ltvCacRatio, 1)}x ROI (all-time: ${ltvCacRatioAlltime != null ? `${fmtNum(ltvCacRatioAlltime, 1)}x` : 'N/D'})

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

${
  searchConsole
    ? `SEO — Google Search Console (últimos 28 días):
- Clicks orgánicos totales: ${fmtNum(searchConsole.clicks)}
- Impresiones totales: ${fmtNum(searchConsole.impressions)}
- CTR promedio: ${fmtNum(searchConsole.avgCtr, 2)}%
- Posición promedio: #${fmtNum(searchConsole.avgPosition, 1)}
- Top keyword: ${searchConsole.topKeyword} (${fmtNum(searchConsole.topKeywordClicks)} clicks)
- Top página: ${shortenSearchConsolePage(searchConsole.topPage)} (${fmtNum(searchConsole.topPageClicks)} clicks)`
    : searchConsoleEmpty
      ? 'SEO — Google Search Console: vinculado hoy, datos disponibles en 24-48h.'
      : 'SEO — Google Search Console: N/D (API no disponible)'
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
