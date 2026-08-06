import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { getSeoKpis, type SeoPositionTrackingKeyword } from '@/lib/dataforseo-api';
import { copToUsd, getUsdFxRates, mxnToUsd } from '@/lib/fx-rates';
import { formatUnknownError } from '@/lib/format-error';
import { ANALYSIS_MODEL } from '@/lib/learning-analysis';
import { fetchWeeklyReportData } from '@/lib/weekly-report';
import type {
  GoogleAdsWeeklyReport,
  GscWeeklyReport,
  MetaAdsWeeklyReport,
  WowNumber,
} from '@/lib/weekly-report/types';

export type WeeklyChannelCompare = {
  fx: { mxn_per_usd: number; cop_per_usd: number };
  meta: {
    spend_mxn: number;
    spend_usd: number;
    conversions: number;
    cpa_mxn: number | null;
    cpa_usd: number | null;
  };
  google: {
    spend_cop: number;
    spend_usd: number;
    conversions: number;
    cpa_cop: number | null;
    cpa_usd: number | null;
  };
  winners: {
    spend: 'meta' | 'google' | 'tie' | null;
    conversions: 'meta' | 'google' | 'tie' | null;
    cpa: 'meta' | 'google' | 'tie' | null;
  };
  budget_recommendation: string;
};

export type WeeklySeoPositionChanges = {
  keywords_improved: number | null;
  keywords_declined: number | null;
  top_improved: SeoPositionTrackingKeyword[];
  top_declined: SeoPositionTrackingKeyword[];
};

export type WeeklyMarketingReport = {
  generated_at: string;
  period_label: string;
  range: { startDate: string; endDate: string };
  previous_range: { startDate: string; endDate: string };
  executive_summary: string[];
  gsc: GscWeeklyReport;
  google_ads: GoogleAdsWeeklyReport;
  meta_ads: MetaAdsWeeklyReport;
  channel_compare: WeeklyChannelCompare;
  seo_position: WeeklySeoPositionChanges;
  errors: string[];
};

function pickHigherWinner(a: number, b: number): 'meta' | 'google' | 'tie' | null {
  if (a <= 0 && b <= 0) return null;
  if (a <= 0) return 'google';
  if (b <= 0) return 'meta';
  if (Math.abs(a - b) < 0.01) return 'tie';
  return a > b ? 'meta' : 'google';
}

function pickLowerCpaWinner(
  metaCpa: number | null,
  googleCpa: number | null,
): 'meta' | 'google' | 'tie' | null {
  if (metaCpa == null && googleCpa == null) return null;
  if (metaCpa == null) return 'google';
  if (googleCpa == null) return 'meta';
  if (Math.abs(metaCpa - googleCpa) < 0.01) return 'tie';
  return metaCpa < googleCpa ? 'meta' : 'google';
}

function buildBudgetRecommendation(
  metaCpaUsd: number | null,
  googleCpaUsd: number | null,
  metaSpendUsd: number,
  googleSpendUsd: number,
): string {
  if (metaCpaUsd == null && googleCpaUsd == null) {
    return 'Sin conversiones suficientes en la semana para recomendar redistribución.';
  }
  if (metaCpaUsd != null && googleCpaUsd != null) {
    if (metaCpaUsd < googleCpaUsd * 0.85) {
      return `Meta CPA ($${metaCpaUsd.toFixed(0)} USD) supera a Google ($${googleCpaUsd.toFixed(0)} USD). Considera incrementar presupuesto Meta ~10-15%.`;
    }
    if (googleCpaUsd < metaCpaUsd * 0.85) {
      return `Google CPA ($${googleCpaUsd.toFixed(0)} USD) supera a Meta ($${metaCpaUsd.toFixed(0)} USD). Considera incrementar presupuesto Google ~10-15%.`;
    }
    return 'CPA similar entre canales. Mantener split actual y optimizar creativos.';
  }
  if (metaCpaUsd != null && googleSpendUsd > metaSpendUsd) {
    return 'Google gastó más sin conversiones medibles. Revisar targeting o pausar campañas de bajo rendimiento.';
  }
  if (googleCpaUsd != null && metaSpendUsd > googleSpendUsd) {
    return 'Meta gastó más sin conversiones medibles. Revisar audiencias o creativos WA.';
  }
  return 'Monitorear una semana más antes de redistribuir presupuesto.';
}

function buildWeeklyChannelCompare(
  meta: MetaAdsWeeklyReport,
  google: GoogleAdsWeeklyReport,
  fx: { mxn_per_usd: number; cop_per_usd: number },
): WeeklyChannelCompare {
  const metaSpendMxn = meta.totals.spend.current;
  const googleSpendCop = google.combined.totals.spend.current;
  const metaSpendUsd = mxnToUsd(metaSpendMxn, fx.mxn_per_usd);
  const googleSpendUsd = copToUsd(googleSpendCop, fx.cop_per_usd);
  const metaConversions = meta.totals.conversations.current;
  const googleConversions = google.combined.totals.conversions.current;
  const metaCpaUsd = metaConversions > 0 ? metaSpendUsd / metaConversions : null;
  const googleCpaUsd = googleConversions > 0 ? googleSpendUsd / googleConversions : null;

  return {
    fx,
    meta: {
      spend_mxn: metaSpendMxn,
      spend_usd: metaSpendUsd,
      conversions: metaConversions,
      cpa_mxn: meta.totals.cpa.current > 0 ? meta.totals.cpa.current : null,
      cpa_usd: metaCpaUsd,
    },
    google: {
      spend_cop: googleSpendCop,
      spend_usd: googleSpendUsd,
      conversions: googleConversions,
      cpa_cop: google.combined.totals.cpa.current > 0 ? google.combined.totals.cpa.current : null,
      cpa_usd: googleCpaUsd,
    },
    winners: {
      spend: pickHigherWinner(metaSpendUsd, googleSpendUsd),
      conversions: pickHigherWinner(metaConversions, googleConversions),
      cpa: pickLowerCpaWinner(metaCpaUsd, googleCpaUsd),
    },
    budget_recommendation: buildBudgetRecommendation(
      metaCpaUsd,
      googleCpaUsd,
      metaSpendUsd,
      googleSpendUsd,
    ),
  };
}

function extractSeoPositionChanges(): Promise<WeeklySeoPositionChanges> {
  return getSeoKpis({ allowStale: true }).then((kpis) => {
    const tracking = kpis.position_tracking;
    const withChange = tracking.top_keywords.filter((k) => k.position_change != null);
    const improved = withChange
      .filter((k) => (k.position_change ?? 0) < 0)
      .sort((a, b) => (a.position_change ?? 0) - (b.position_change ?? 0))
      .slice(0, 10);
    const declined = withChange
      .filter((k) => (k.position_change ?? 0) > 0)
      .sort((a, b) => (b.position_change ?? 0) - (a.position_change ?? 0))
      .slice(0, 10);

    return {
      keywords_improved: tracking.keywords_improved,
      keywords_declined: tracking.keywords_declined,
      top_improved: improved,
      top_declined: declined,
    };
  });
}

function fmtWow(wow: WowNumber, suffix = ''): string {
  const pct =
    wow.delta_pct != null
      ? ` (${wow.delta >= 0 ? '+' : ''}${wow.delta_pct}% vs sem. ant.)`
      : '';
  return `${wow.current}${suffix}${pct}`;
}

function buildClaudePrompt(report: Omit<WeeklyMarketingReport, 'executive_summary'>): string {
  return `Genera un resumen ejecutivo semanal de marketing para Kalyo (SaaS para psicólogos en LATAM).

Periodo: ${report.range.startDate} a ${report.range.endDate}

SEO ORGÁNICO (GSC):
- Clicks: ${fmtWow(report.gsc.totals.clicks)}
- Impresiones: ${fmtWow(report.gsc.totals.impressions)}
- CTR: ${fmtWow(report.gsc.totals.ctr, '%')}
- Posición prom.: ${fmtWow(report.gsc.totals.position)}
- Top página: ${report.gsc.top_pages_by_clicks[0]?.page ?? '—'}

GOOGLE ADS (COP, cuentas ${report.google_ads.customer_ids.join('+')}):
- Gasto: ${fmtWow(report.google_ads.combined.totals.spend, ' COP')}
- Conversiones: ${fmtWow(report.google_ads.combined.totals.conversions)}
- CPA: ${fmtWow(report.google_ads.combined.totals.cpa, ' COP')}
- CTR: ${fmtWow(report.google_ads.combined.totals.ctr, '%')}

META ADS (MXN):
- Gasto: ${fmtWow(report.meta_ads.totals.spend, ' MXN')}
- Conversaciones WA: ${fmtWow(report.meta_ads.totals.conversations)}
- CPA: ${fmtWow(report.meta_ads.totals.cpa, ' MXN')}
- CTR: ${fmtWow(report.meta_ads.totals.ctr, '%')}
- Campañas activas: ${report.meta_ads.active_campaigns.filter((c) => c.effective_status === 'ACTIVE').length}

COMPARATIVA CANALES (USD):
- Meta CPA USD: ${report.channel_compare.meta.cpa_usd?.toFixed(2) ?? '—'}
- Google CPA USD: ${report.channel_compare.google.cpa_usd?.toFixed(2) ?? '—'}
- Recomendación presupuesto: ${report.channel_compare.budget_recommendation}

SEO POSICIONES (DataForSEO MX):
- Keywords mejoradas: ${report.seo_position.keywords_improved ?? '—'}
- Keywords empeoradas: ${report.seo_position.keywords_declined ?? '—'}

Responde JSON: { "bullets": ["...", "...", "...", "...", "..."] }
Exactamente 5 bullets en español (México), concisos, accionables, sin markdown.`;
}

const EXECUTIVE_SUMMARY_SYSTEM = `Eres analista de marketing digital para Kalyo.
Responde ÚNICAMENTE con JSON válido: { "bullets": ["...", ...] }
Exactamente 5 bullets, español México, sin markdown.`;

export async function generateExecutiveSummaryBullets(
  report: Omit<WeeklyMarketingReport, 'executive_summary'>,
): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fallbackExecutiveSummary(report);
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 1024,
      system: EXECUTIVE_SUMMARY_SYSTEM,
      messages: [{ role: 'user', content: buildClaudePrompt(report) }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    const raw = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in Claude response');
    const parsed = JSON.parse(jsonMatch[0]) as { bullets?: string[] };
    if (!Array.isArray(parsed.bullets) || parsed.bullets.length === 0) {
      throw new Error('Invalid bullets array');
    }
    return parsed.bullets.slice(0, 5);
  } catch (error) {
    console.warn('[weekly-report-builder] Claude summary failed:', formatUnknownError(error));
    return fallbackExecutiveSummary(report);
  }
}

function fallbackExecutiveSummary(
  report: Omit<WeeklyMarketingReport, 'executive_summary'>,
): string[] {
  const bullets: string[] = [];
  bullets.push(
    `SEO orgánico: ${report.gsc.totals.clicks.current} clicks (${report.gsc.totals.clicks.delta_pct ?? 0}% vs sem. ant.), CTR ${report.gsc.totals.ctr.current}%.`,
  );
  bullets.push(
    `Google Ads: $${report.google_ads.combined.totals.spend.current.toLocaleString('es-MX')} COP gastados, ${report.google_ads.combined.totals.conversions.current} conversiones.`,
  );
  bullets.push(
    `Meta Ads: $${report.meta_ads.totals.spend.current.toLocaleString('es-MX')} MXN gastados, ${report.meta_ads.totals.conversations.current} conversaciones WA.`,
  );
  bullets.push(
    `CPA USD — Meta: $${report.channel_compare.meta.cpa_usd?.toFixed(0) ?? '—'} vs Google: $${report.channel_compare.google.cpa_usd?.toFixed(0) ?? '—'}.`,
  );
  bullets.push(report.channel_compare.budget_recommendation);
  return bullets;
}

/** Build the full weekly marketing report (Block 2). */
export async function buildWeeklyMarketingReport(): Promise<WeeklyMarketingReport> {
  const [fetchers, fx, seoResult] = await Promise.all([
    fetchWeeklyReportData(),
    getUsdFxRates(),
    extractSeoPositionChanges().catch((error) => ({
      keywords_improved: null,
      keywords_declined: null,
      top_improved: [] as SeoPositionTrackingKeyword[],
      top_declined: [] as SeoPositionTrackingKeyword[],
      _error: formatUnknownError(error),
    })),
  ]);

  const errors: string[] = [];
  if (fetchers.gsc.error) errors.push(`GSC: ${fetchers.gsc.error}`);
  if (fetchers.google_ads.error) errors.push(`Google Ads: ${fetchers.google_ads.error}`);
  if (fetchers.meta_ads.error) errors.push(`Meta Ads: ${fetchers.meta_ads.error}`);
  if ('_error' in seoResult && seoResult._error) errors.push(`SEO posiciones: ${seoResult._error}`);

  const channel_compare = buildWeeklyChannelCompare(
    fetchers.meta_ads,
    fetchers.google_ads,
    fx,
  );

  const seo_position: WeeklySeoPositionChanges = {
    keywords_improved: seoResult.keywords_improved,
    keywords_declined: seoResult.keywords_declined,
    top_improved: seoResult.top_improved,
    top_declined: seoResult.top_declined,
  };

  const range = fetchers.gsc.range;
  const previous_range = fetchers.gsc.previous_range;

  const partial: Omit<WeeklyMarketingReport, 'executive_summary'> = {
    generated_at: new Date().toISOString(),
    period_label: `${range.startDate} → ${range.endDate}`,
    range,
    previous_range,
    gsc: fetchers.gsc,
    google_ads: fetchers.google_ads,
    meta_ads: fetchers.meta_ads,
    channel_compare,
    seo_position,
    errors,
  };

  const executive_summary = await generateExecutiveSummaryBullets(partial);

  return { ...partial, executive_summary };
}
