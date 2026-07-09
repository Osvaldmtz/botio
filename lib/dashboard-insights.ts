import type { MRRMetrics } from '@/lib/stripe-mrr';
import type { FunnelMetrics, MetricsBundle } from '@/lib/metrics-queries';

export function identifyFunnelBottleneck(funnel: FunnelMetrics): {
  stage: string;
  rate: number;
} | null {
  const steps = [
    { stage: 'Lead → Qualified', rate: funnel.conversion_rates.lead_to_qualified },
    { stage: 'Qualified → Trial', rate: funnel.conversion_rates.qualified_to_trial },
    { stage: 'Trial → Paid', rate: funnel.conversion_rates.trial_to_paid },
  ];
  const weakest = steps.reduce((min, s) => (s.rate < min.rate ? s : min), steps[0]);
  if (weakest.rate >= 50 || funnel.leads < 5) return null;
  return weakest;
}

export function generateInsights(
  data: MetricsBundle,
  mrr: MRRMetrics,
): string[] {
  const insights: string[] = [];

  if (mrr.available && mrr.net_growth_mrr_usd > 0) {
    insights.push(`📈 MRR creció +$${mrr.net_growth_mrr_usd} USD este mes`);
  } else if (mrr.available && mrr.mrr_growth_pct !== null && mrr.mrr_growth_pct > 0) {
    insights.push(`📈 MRR creció +${mrr.mrr_growth_pct}% este mes`);
  } else if (!mrr.available) {
    insights.push('ℹ️ MRR no disponible — configura STRIPE_SECRET_KEY en Vercel');
  }

  const topObj = data.top_objections[0];
  if (topObj && topObj.count >= 3) {
    insights.push(
      `⚠️ ${topObj.count} objeciones por '${topObj.label}' — atacar esta objeción es prioridad`,
    );
  }

  const priceClosures = data.closure_breakdown.price ?? 0;
  const totalClosed = Object.values(data.closure_breakdown).reduce((a, b) => a + b, 0);
  if (totalClosed > 0 && priceClosures / totalClosed >= 0.25) {
    const pct = Math.round((priceClosures / totalClosed) * 100);
    insights.push(`⚠️ ${pct}% de cierres fue por precio — prioriza trial gratis antes de cupones`);
  }

  const channelEntries = Object.entries(data.by_channel)
    .map(([name, stats]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      rate: stats.leads > 0 ? (stats.paid / stats.leads) * 100 : 0,
      leads: stats.leads,
    }))
    .filter((c) => c.leads > 0)
    .sort((a, b) => b.rate - a.rate);

  if (channelEntries[0] && channelEntries[0].rate > 0) {
    insights.push(
      `🔥 Mejor canal: ${channelEntries[0].name} (${channelEntries[0].rate.toFixed(1)}% conversión total)`,
    );
  }

  const bottleneck = identifyFunnelBottleneck(data.funnel);
  if (bottleneck) {
    insights.push(`🔍 Bottleneck en funnel: ${bottleneck.stage} (${bottleneck.rate}% conversión)`);
  }

  if (data.unattended_hot_leads > 0) {
    insights.push(
      `🚨 ${data.unattended_hot_leads} HOT lead(s) sin atender — contactar en próximos 30 min`,
    );
  }

  const converted = data.closure_breakdown.converted ?? 0;
  if (converted > 0 && data.funnel.conversion_rates.overall > 0) {
    insights.push(`✅ ${converted} conversiones confirmadas en últimos 30 días`);
  }

  if (insights.length === 0) {
    insights.push('📊 Acumula más conversaciones para insights automáticos accionables.');
  }

  return insights.slice(0, 6);
}
