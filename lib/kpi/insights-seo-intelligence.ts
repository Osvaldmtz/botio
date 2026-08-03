import 'server-only';

import { getSeoKpis, type SeoKpisResponse } from '@/lib/dataforseo-api';
import { clsStatus, lcpStatus, tbtStatus, type VitalsStatus } from '@/lib/pagespeed-utils';

export type KpiSeoIntelligenceKeyword = {
  keyword: string;
  position: number;
  volume: number;
  etv: number;
  opportunity_label: string | null;
};

export type KpiSeoIntelligenceCompetitor = {
  domain: string;
  common_keywords: number;
  visibility: number;
};

export type KpiSeoIntelligence = {
  available: boolean;
  error: string | null;
  authority_score: number;
  domain_rank: number;
  backlinks_total: number;
  referring_domains: number;
  follow_count: number;
  nofollow_count: number;
  keywords_mx: KpiSeoIntelligenceKeyword[];
  competitors: KpiSeoIntelligenceCompetitor[];
  lcp: number | null;
  cls: number | null;
  tbt: number | null;
  ai_mentions: {
    chatgpt: number;
    google_ai: number;
    gemini: number;
    total: number;
  };
  quality_backlinks: Array<{ domain: string; dofollow: boolean }>;
  last_updated: string | null;
};

export function emptyKpiSeoIntelligence(error: string | null = null): KpiSeoIntelligence {
  return {
    available: false,
    error,
    authority_score: 0,
    domain_rank: 0,
    backlinks_total: 0,
    referring_domains: 0,
    follow_count: 0,
    nofollow_count: 0,
    keywords_mx: [],
    competitors: [],
    lcp: null,
    cls: null,
    tbt: null,
    ai_mentions: { chatgpt: 0, google_ai: 0, gemini: 0, total: 0 },
    quality_backlinks: [],
    last_updated: null,
  };
}

function domainFromUrl(url: string): string {
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    return new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function labelKeywords(
  keywords: Array<{ keyword: string; position: number; volume: number; etv: number }>,
): KpiSeoIntelligenceKeyword[] {
  if (keywords.length === 0) return [];

  const sortedByOpportunity = [...keywords].sort(
    (a, b) => b.volume / Math.max(a.position, 1) - a.volume / Math.max(b.position, 1),
  );
  const topOpportunity = sortedByOpportunity[0];

  return keywords.map((row) => {
    const isTopOpportunity =
      row.keyword === topOpportunity.keyword &&
      row.volume >= 300 &&
      row.position > 20;
    const isLargeOpportunity = row.volume >= 1000 && row.position >= 40;

    return {
      ...row,
      opportunity_label:
        isTopOpportunity || isLargeOpportunity ? 'OPORTUNIDAD GRANDE' : null,
    };
  });
}

function mapSeoKpisToIntelligence(seo: SeoKpisResponse): KpiSeoIntelligence {
  const keywordsRaw = [...seo.position_tracking.top_keywords]
    .sort((a, b) => b.volume - a.volume || a.position - b.position)
    .slice(0, 8)
    .map((row) => ({
      keyword: row.keyword,
      position: row.position,
      volume: row.volume,
      etv: row.etv,
    }));

  const aiByModel = new Map(seo.ai_visibility?.by_model.map((row) => [row.model, row.mentions]) ?? []);
  const chatgpt = aiByModel.get('ChatGPT') ?? 0;
  const googleAi = aiByModel.get('Google AI Overview') ?? 0;
  const gemini = aiByModel.get('Gemini') ?? 0;

  const qualityBacklinks = (seo.backlinks_detail?.top_backlinks ?? []).map((row) => ({
    domain: domainFromUrl(row.url_from),
    dofollow: row.dofollow,
  }));

  return {
    available: seo.configured || keywordsRaw.length > 0 || (seo.backlinks?.total ?? 0) > 0,
    error: null,
    authority_score: seo.authority_score.value,
    domain_rank: seo.backlinks?.rank ?? 0,
    backlinks_total: seo.backlinks?.total ?? 0,
    referring_domains: seo.backlinks?.referring_domains ?? 0,
    follow_count: seo.backlinks_detail?.follow_count ?? 0,
    nofollow_count: seo.backlinks_detail?.nofollow_count ?? 0,
    keywords_mx: labelKeywords(keywordsRaw),
    competitors: seo.competitors.slice(0, 5).map((row) => ({
      domain: row.domain,
      common_keywords: row.common_keywords,
      visibility: row.etv,
    })),
    lcp: seo.pagespeed?.lcp ?? null,
    cls: seo.pagespeed?.cls ?? null,
    tbt: seo.pagespeed?.tbt ?? null,
    ai_mentions: {
      chatgpt,
      google_ai: googleAi,
      gemini,
      total: seo.ai_visibility?.total_mentions ?? chatgpt + googleAi + gemini,
    },
    quality_backlinks: qualityBacklinks,
    last_updated: seo.last_updated,
  };
}

export async function fetchSeoIntelligenceData(): Promise<KpiSeoIntelligence> {
  try {
    const seo = await getSeoKpis();
    return mapSeoKpisToIntelligence(seo);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[kpi] fetchSeoIntelligenceData failed', error);
    return emptyKpiSeoIntelligence(message);
  }
}

function vitalsShortLabel(status: VitalsStatus): string {
  if (status === 'good') return '✓';
  if (status === 'needs-improvement') return 'MEJORA';
  return 'FALLA';
}

function fmtVol(n: number): string {
  return Math.round(n).toLocaleString('es-MX');
}

export function formatSeoIntelligenceBlock(seo: KpiSeoIntelligence): string {
  if (!seo.available && seo.error) {
    return `=== SEO INTELLIGENCE ===
N/D (${seo.error})`;
  }

  if (!seo.available) {
    return `=== SEO INTELLIGENCE ===
Sin datos del módulo SEO (/admin/seo). Ejecuta refresh en el dashboard SEO.`;
  }

  const keywordLines =
    seo.keywords_mx.length > 0
      ? seo.keywords_mx
          .map((row) => {
            const etvPart = row.etv > 0 ? `, ETV ${fmtVol(row.etv)}` : '';
            const opp = row.opportunity_label ? ` → ${row.opportunity_label}` : '';
            return `- ${row.keyword}: pos ${row.position}, vol ${fmtVol(row.volume)}/mes${etvPart}${opp}`;
          })
          .join('\n')
      : '- Sin keywords rastreadas en México';

  const competitorLine =
    seo.competitors.length > 0
      ? seo.competitors.map((row) => row.domain).join(', ')
      : 'N/D';

  const lcpLine =
    seo.lcp != null
      ? `LCP ${seo.lcp.toFixed(1)}s (${vitalsShortLabel(lcpStatus(seo.lcp))})`
      : 'LCP N/D';
  const tbtLine =
    seo.tbt != null
      ? `TBT ${Math.round(seo.tbt).toLocaleString('es-MX')}ms (${vitalsShortLabel(tbtStatus(seo.tbt))})`
      : 'TBT N/D';
  const clsLine =
    seo.cls != null
      ? `CLS ${seo.cls.toFixed(3)} ${vitalsShortLabel(clsStatus(seo.cls))}`
      : 'CLS N/D';

  const { chatgpt, google_ai, gemini, total } = seo.ai_mentions;
  const aiLine =
    total > 0
      ? `${total} menciones (ChatGPT: ${chatgpt}, Google AI: ${google_ai}, Gemini: ${gemini})`
      : `0 menciones en ChatGPT / Google AI / Gemini`;

  const dofollowCount = seo.quality_backlinks.filter((row) => row.dofollow).length;
  const nofollowExamples = seo.quality_backlinks
    .filter((row) => !row.dofollow)
    .map((row) => `${row.domain} = nofollow`)
    .slice(0, 3);
  const backlinkQualityLine =
    dofollowCount > 0
      ? `${dofollowCount} dofollow reales${nofollowExamples.length > 0 ? ` (${nofollowExamples.join(', ')})` : ''}`
      : `0 dofollow reales${nofollowExamples.length > 0 ? ` (${nofollowExamples.join(', ')})` : ''}`;

  const followRatio =
    seo.follow_count + seo.nofollow_count > 0
      ? `follow ${fmtVol(seo.follow_count)} / nofollow ${fmtVol(seo.nofollow_count)}`
      : 'ratio follow/nofollow N/D';

  return `=== SEO INTELLIGENCE ===
Authority Score: ${seo.authority_score} | Domain Rank: ${seo.domain_rank} | Backlinks: ${fmtVol(seo.backlinks_total)} | Ref domains: ${fmtVol(seo.referring_domains)} (${followRatio})

Keywords (México):
${keywordLines}

Competidores principales: ${competitorLine}

Core Web Vitals (mobile): ${lcpLine}, ${tbtLine}, ${clsLine}

AI Visibility: ${aiLine}

Backlinks de calidad: ${backlinkQualityLine}

INSTRUCCIONES PARA ANÁLISIS (usar estos datos en la sección SEO detallado):
- Identifica la keyword con mayor volumen en posición lejana (ej. phq-9 pos 84 con 3,600/mes) como la mayor oportunidad orgánica — optimizar esa página podría generar tráfico significativo.
- Si LCP > 4s o TBT > 600ms en móvil, conéctalo con scroll depth bajo de Clarity — el problema no es solo copy, es velocidad/perceived performance.
- Si AI Visibility = 0, Kalyo no existe para ChatGPT ni Google AI cuando un psicólogo pregunta sobre herramientas clínicas.
- Si backlinks dofollow reales ≈ 0, falta autoridad de dominio para competir contra competidores (scribd, carepatron, studocu) en keywords de herramientas clínicas.`;
}
