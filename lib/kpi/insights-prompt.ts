import type { KpiInsightsData } from '@/lib/kpi/insights-types';
import type { OperationalMetrics } from '@/lib/kpi/operational-metrics';
import type { ChannelCompareResponse } from '@/lib/ads-channel-compare-types';
import type { KpiSeoDetail } from '@/lib/kpi/insights-enrichment';
import {
  MXN_PER_USD,
  computeLtvDerived,
  formatLtvMonthsLabel,
} from '@/lib/kpi/ltv-utils';

export const KPI_ANALYSIS_SYSTEM_PROMPT =
  'Eres un estratega de marketing digital y growth specialist especializado en SaaS B2B para salud mental en Latinoamérica. Analizas los KPIs de Kalyo, una plataforma para psicólogos clínicos. Interpretas métricas operativas de WhatsApp, SEO detallado (keywords, CTR, caídas de posición, Clarity/GA4) y comparación Meta Ads vs Google Ads (CAC/CPL, LTV:CAC por canal). Sé directo, específico y usa los números reales en cada insight. No des recomendaciones genéricas.';

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

function formatOperationalBlock(op: OperationalMetrics | null | undefined): string {
  if (!op) {
    return 'MÉTRICAS OPERATIVAS: N/D (no disponibles en esta ejecución)';
  }

  const { patientInbound, whatsappRouting, trialOnboarding, sofiaSales } = op;

  const psychLines =
    patientInbound.by_psychologist.length > 0
      ? patientInbound.by_psychologist
          .slice(0, 5)
          .map(
            (p) =>
              `  - ${p.psychologist_name ?? p.psychologist_id.slice(0, 8)}: ${p.message_count} msgs, ${p.unique_patients} paciente(s)`,
          )
          .join('\n')
      : '  - Sin mensajes registrados aún';

  const dripLines = trialOnboarding.drip_funnel
    .filter((s) => s.count > 0 || s.step === 'total')
    .map(
      (s) =>
        `  - ${s.label}: ${s.count} (${fmtNum(s.pct_of_total, 1)}% del total${s.drop_from_prev != null ? `, drop −${s.drop_from_prev}` : ''})`,
    )
    .join('\n');

  const day8Breakdown = Object.entries(trialOnboarding.day8_survey.breakdown)
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `${label}: ${n}`)
    .join(' | ');

  const routingNote = whatsappRouting.kalyo_bot_configured
    ? `- Redirigidos a psicólogo (patient_inbound): ${fmtNum(whatsappRouting.patient_redirected_30d)} (${fmtNum(whatsappRouting.redirect_rate_pct, 1)}% del tráfico WA Kalyo)
- Procesados por Sofía (msgs usuario): ${fmtNum(whatsappRouting.sofia_user_messages_30d)}`
    : '- Routing WA: KALYO_BOT_ID no configurado';

  const patientNote = patientInbound.available
    ? `- Total mensajes patient_inbound (30d): ${fmtNum(patientInbound.total_30d)}
- Pacientes únicos que escribieron: ${fmtNum(patientInbound.unique_patients_30d)} (${fmtNum(patientInbound.repeat_patients_30d)} reincidentes)
- Psicólogos notificados: ${fmtNum(patientInbound.psychologists_notified_30d)}
- Top psicólogos:
${psychLines}`
    : `- Patient inbound: tabla aún no disponible (eventos se registran desde el deploy)`;

  return `WHATSAPP — ROUTING PACIENTES VS SOFÍA (30d):
${routingNote}
${patientNote}

ONBOARDING TRIAL (30d):
- Trials enrollados: ${fmtNum(trialOnboarding.enrolled_30d)} | Upgraded a paid: ${fmtNum(trialOnboarding.upgraded_30d)} (${fmtNum(trialOnboarding.conversion_rate_pct, 1)}%)
- Respondieron en WA: ${fmtNum(trialOnboarding.response_rate_pct, 1)}% | Unsubscribe: ${fmtNum(trialOnboarding.unsubscribe_rate_pct, 1)}%
- Funnel por día (mensajes drip enviados):
${dripLines}
- Encuesta día 8: enviada a ${fmtNum(trialOnboarding.day8_survey.sent_30d)} | respondieron ${fmtNum(trialOnboarding.day8_survey.responded_30d)} (${fmtNum(trialOnboarding.day8_survey.response_rate_pct, 1)}%) | pendientes ${fmtNum(trialOnboarding.day8_survey.pending_30d)}
  Respuestas: ${day8Breakdown || 'N/D'}
- Día 9 PRIMER50 (onboarding cron): ${fmtNum(trialOnboarding.day9_primer50_sent_30d)} enviados
- PRIMER50 vía Sofía (objeciones/ventas): ${fmtNum(sofiaSales.primer50_links_sent_30d)} links | share cupón vs trials ofrecidos: ${sofiaSales.coupon_share_pct != null ? `${fmtNum(sofiaSales.coupon_share_pct, 1)}%` : 'N/D'}`;
}

function formatSeoDetailBlock(
  seo: KpiSeoDetail,
  clarity: KpiInsightsData['clarity'],
  ga4Landing: KpiInsightsData['ga4Landing'],
): string {
  if (!seo.available) {
    return `DATOS SEO DETALLADOS: N/D${seo.error ? ` (${seo.error})` : ''}`;
  }

  const kwTop5 = seo.keywords_in_top5
    .slice(0, 6)
    .map(
      (k) =>
        `  - "${k.query}": pos #${fmtNum(k.position, 1)}, ${fmtNum(k.clicks)} clicks, ${fmtNum(k.impressions)} imp, CTR ${fmtNum(k.ctr, 2)}%`,
    )
    .join('\n');

  const kwImprove = seo.keywords_to_improve
    .slice(0, 6)
    .map(
      (k) =>
        `  - "${k.query}": pos #${fmtNum(k.position, 1)}, ${fmtNum(k.impressions)} imp (oportunidad subir a top 5)`,
    )
    .join('\n');

  const lowCtr = seo.pages_low_ctr
    .slice(0, 6)
    .map(
      (p) =>
        `  - ${shortenSearchConsolePage(p.page)}: ${fmtNum(p.impressions)} imp, ${fmtNum(p.clicks)} clicks, CTR ${fmtNum(p.ctr, 2)}% (pos #${fmtNum(p.position, 1)})`,
    )
    .join('\n');

  const drops = seo.pages_position_drop
    .slice(0, 6)
    .map(
      (p) =>
        `  - ${shortenSearchConsolePage(p.page)}: #${fmtNum(p.position_previous, 1)} → #${fmtNum(p.position_current, 1)} (+${fmtNum(p.position_delta, 1)} peor)`,
    )
    .join('\n');

  const landingPages = seo.landing_entry_pages
    .slice(0, 6)
    .map(
      (p) =>
        `  - ${p.pagePath}: ${fmtNum(p.screenPageViews)} vistas, bounce ${fmtNum(p.bounce_rate_pct, 1)}%, duración ${fmtNum(p.avg_duration_sec)}s`,
    )
    .join('\n');

  const clarityNote = clarity
    ? `Clarity scroll depth sitio: ${fmtNum(clarity.scrollDepth, 1)}% | Quick backs: ${fmtNum(clarity.quickBacks, 1)}%`
    : 'Clarity: N/D';

  return `DATOS SEO DETALLADOS (Search Console 28d + GA4 landing):
- Keywords ya en top 5 (proteger/optimizar snippet):
${kwTop5 || '  - N/D'}
- Keywords a mejorar (pos >5 con alto volumen):
${kwImprove || '  - N/D'}
- Páginas con brecha impresiones/clicks (CTR bajo → title/meta débil):
${lowCtr || '  - N/D'}
- Páginas con mayor caída de posición vs período anterior:
${drops || '  - Sin caídas significativas'}
- Páginas de entrada kalyo.io (GA4, 30d) — bounce rate por landing:
${landingPages || '  - N/D'}
- Bounce rate global landing: ${fmtNum(ga4Landing.bounce_rate, 1)}% | ${clarityNote}
- INSTRUCCIÓN: Conecta scroll depth bajo con páginas de entrada de alto bounce; prioriza mejoras de title/meta en URLs de alto tráfico orgánico con CTR bajo.`;
}

function formatChannelCompareBlock(
  compare: ChannelCompareResponse | null,
  ltvAvgUsd: number,
): string {
  if (!compare) {
    return 'COMPARACIÓN META vs GOOGLE ADS: N/D (error al cargar datos de canales)';
  }

  const { meta, google } = compare;
  const metaLtvCac =
    meta.cpa_usd != null && meta.cpa_usd > 0 ? ltvAvgUsd / meta.cpa_usd : null;
  const googleLtvCac =
    google.cpa_usd != null && google.cpa_usd > 0 ? ltvAvgUsd / google.cpa_usd : null;

  const tableAvailable = meta.available && google.available;

  if (tableAvailable) {
    return `COMPARACIÓN META ADS vs GOOGLE ADS (30d, normalizado USD):
| Canal | Presupuesto | Clicks | Conversiones | CPL/CAC (USD) | LTV:CAC est. |
| Meta | $${fmtNum(meta.spend_usd, 2)} (${fmtNum(meta.spend)} MXN) | ${fmtNum(meta.clicks)} | ${fmtNum(meta.conversions)} ${meta.conversion_label} | ${meta.cpa_usd != null ? fmtMoney(meta.cpa_usd) : 'N/D'} | ${metaLtvCac != null ? `${fmtNum(metaLtvCac, 1)}x` : 'N/D'} |
| Google | $${fmtNum(google.spend_usd, 2)} (${fmtNum(google.spend)} COP) | ${fmtNum(google.clicks)} | ${fmtNum(google.conversions)} ${google.conversion_label} | ${google.cpa_usd != null ? fmtMoney(google.cpa_usd) : 'N/D'} | ${googleLtvCac != null ? `${fmtNum(googleLtvCac, 1)}x` : 'N/D'} |
- Mejor CPL/CAC: ${compare.winners.cpa ?? 'empate/indeterminado'}
- Más conversiones: ${compare.winners.conversions ?? 'empate/indeterminado'}
- INSTRUCCIÓN: Indica qué canal tiene mejor ratio LTV:CAC y si conviene reasignar presupuesto.`;
  }

  if (meta.available && !google.available) {
    return `COMPARACIÓN META ADS vs GOOGLE ADS:
- Meta Ads: DISPONIBLE — gasto $${fmtNum(meta.spend_usd, 2)} USD, ${fmtNum(meta.conversions)} ${meta.conversion_label}, CPL ~${meta.cpa_usd != null ? fmtMoney(meta.cpa_usd) : 'N/D'}, LTV:CAC est. ${metaLtvCac != null ? `${fmtNum(metaLtvCac, 1)}x` : 'N/D'}
- Google Ads: SIN DATOS${google.error ? ` (${google.error})` : ''}
- INSTRUCCIÓN: Menciona explícitamente que no hay datos de Google Ads. Con LTV ~${fmtMoney(ltvAvgUsd)}, recomienda si vale la pena activar/probar Google dado el rendimiento actual de Meta.`;
  }

  if (!meta.available && google.available) {
    return `COMPARACIÓN META ADS vs GOOGLE ADS:
- Meta Ads: SIN DATOS${meta.error ? ` (${meta.error})` : ''}
- Google Ads: DISPONIBLE — gasto $${fmtNum(google.spend_usd, 2)} USD, ${fmtNum(google.conversions)} ${google.conversion_label}, CPL ~${google.cpa_usd != null ? fmtMoney(google.cpa_usd) : 'N/D'}, LTV:CAC est. ${googleLtvCac != null ? `${fmtNum(googleLtvCac, 1)}x` : 'N/D'}
- INSTRUCCIÓN: Menciona explícitamente que no hay datos de Meta Ads. Evalúa si reactivar Meta dado LTV ~${fmtMoney(ltvAvgUsd)}.`;
  }

  return `COMPARACIÓN META ADS vs GOOGLE ADS:
- Meta: sin datos${meta.error ? ` (${meta.error})` : ''}
- Google: sin datos${google.error ? ` (${google.error})` : ''}
- INSTRUCCIÓN: Ningún canal paid reportó datos; no inventes CAC por canal.`;
}

export function buildKpiAnalysisPrompt(data: KpiInsightsData): string {
  const {
    kalyo,
    twilio,
    instagram,
    metaAds,
    ga4Landing,
    ga4App,
    clarity,
    searchConsole,
    searchConsoleEmpty,
    seoDetail,
    channelCompare,
    operational,
  } = data;

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

${formatOperationalBlock(operational)}

${formatSeoDetailBlock(seoDetail, clarity, ga4Landing)}

${formatChannelCompareBlock(channelCompare, ltvAvg)}

Responde en este formato exacto con estas 6 secciones:

## ✅ Lo que está funcionando
[3-4 bullets con números reales, qué métricas son positivas y por qué importan]

## ⚠️ Alertas y problemas detectados
[3-4 bullets con los problemas más urgentes basados en los datos]

## 🔍 Análisis SEO detallado
[4-6 bullets: keywords top 5 vs a mejorar, páginas con CTR bajo, caídas de posición, conexión scroll depth Clarity + bounce GA4 por página de entrada. Acciones concretas de title/meta/contenido.]

## ⚖️ Comparación Meta Ads vs Google Ads
[Tabla o bullets comparando CAC/CPL, conversiones y presupuesto por canal. Si falta un canal, dilo explícitamente. Indica mejor ratio LTV:CAC y recomendación de presupuesto.]

## 🎯 Top 3 acciones esta semana
[Exactamente 3 acciones concretas, ordenadas por impacto, con el número/métrica que justifica cada una]

## 📈 Proyección a 30 días
[Si ejecutas las 3 acciones anteriores, qué métricas podrían mejorar y a qué valores estimados]`;
}
