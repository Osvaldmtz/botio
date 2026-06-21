import type { KpiInsightsData } from '@/lib/kpi/insights-types';

export const KPI_ANALYSIS_SYSTEM_PROMPT =
  'Eres un estratega de marketing digital y growth specialist especializado en SaaS B2B para salud mental en Latinoamérica. Analizas los KPIs de Kalyo, una plataforma para psicólogos clínicos. Sé directo, específico y usa los números reales en cada insight. No des recomendaciones genéricas.';

/** Approximate MXN/USD for comparing Meta Ads spend (MXN) with MRR (USD) */
const MXN_PER_USD = 17.5;

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
  const { kalyo, twilio, instagram, metaAds, ga4Landing, ga4App } = data;

  const spendMxn = metaAds.spend;
  const spendUsdEquiv = spendMxn / MXN_PER_USD;
  const subscribers = kalyo.active_subscribers ?? 0;
  const cacMxn = subscribers > 0 ? spendMxn / subscribers : null;
  const cacUsd = subscribers > 0 ? spendUsdEquiv / subscribers : null;

  const metaCurrency = metaAds.currency ?? 'MXN';

  return `Analiza estos KPIs de Kalyo y dame insights accionables:

NEGOCIO:
- MRR: ${fmtMoney(kalyo.mrr)} | Suscriptores activos: ${fmtNum(kalyo.active_subscribers)} (Pro: ${fmtNum(kalyo.plan_pro)}, Max: ${fmtNum(kalyo.plan_max)}) | Trials: ${fmtNum(kalyo.trialing)}

WHATSAPP (últimos 30 días):
- Mensajes enviados: ${fmtNum(twilio.total_sent)} | Tasa entrega: ${fmtNum(twilio.delivery_rate, 1)}% | Fallidos: ${fmtNum(twilio.failed)} | Costo: ${fmtMoney(twilio.total_cost_usd)}

INSTAGRAM @kalyo_app:
- Seguidores: ${fmtNum(instagram.followers)} | Reach 7d: ${fmtNum(instagram.reach_7d)} | Impresiones 7d: ${fmtNum(instagram.impressions_7d)} | Engagement: ${fmtNum(instagram.engagement_rate, 1)}%

META ADS:
IMPORTANTE: El gasto de Meta Ads está en pesos mexicanos (${metaCurrency}). La cuenta opera en México. Para comparar con MRR en USD usar tipo de cambio ~${MXN_PER_USD} MXN/USD. Gasto equivalente en USD: ~${fmtMoney(spendUsdEquiv)}.
- Gasto 30d: ${fmtMxn(spendMxn)} | Impresiones: ${fmtNum(metaAds.impressions)} | Clicks: ${fmtNum(metaAds.clicks)} | CTR: ${fmtNum(metaAds.ctr, 2)}%
- CAC en MXN: ${cacMxn != null ? `${fmtMxn(cacMxn)} por suscriptor` : 'N/D'} (~${cacUsd != null ? `${fmtMoney(cacUsd)} USD` : 'N/D'} por suscriptor)

WEB — kalyo.io (landing):
- Usuarios 30d: ${fmtNum(ga4Landing.users)} | Sesiones: ${fmtNum(ga4Landing.sessions)} | Engagement: ${fmtNum(ga4Landing.engagement_rate, 1)}% | Bounce: ${fmtNum(ga4Landing.bounce_rate, 1)}%

WEB — app.kalyo.io:
- Usuarios 20d: ${fmtNum(ga4App.users)} | Sesiones: ${fmtNum(ga4App.sessions)} | Engagement: ${fmtNum(ga4App.engagement_rate, 1)}% | Duración promedio: ${fmtNum(ga4App.avg_duration_min, 1)} min

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
