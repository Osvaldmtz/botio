'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  FileText,
  Globe2,
  Link2,
  Minus,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/admin-shell';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import type {
  SeoCountryOverview,
  SeoKpisResponse,
  SeoPageSpeedSummary,
  SeoPositionTracking,
  SeoPositionTrackingKeyword,
  SeoSiteAudit,
  SeoTopKeyword,
} from '@/lib/dataforseo-api';
import { clsStatus, lcpStatus, tbtStatus, type VitalsStatus } from '@/lib/pagespeed-utils';

const KALYO_PURPLE = '#7C3DE3';

const SEO_COUNTRIES = [
  { code: 2484, country: 'MX', label: 'México', flag: '🇲🇽' },
  { code: 2170, country: 'CO', label: 'Colombia', flag: '🇨🇴' },
  { code: 2032, country: 'AR', label: 'Argentina', flag: '🇦🇷' },
  { code: 2724, country: 'ES', label: 'España', flag: '🇪🇸' },
  { code: 2604, country: 'PE', label: 'Perú', flag: '🇵🇪' },
] as const;

const COUNTRIES = SEO_COUNTRIES.map((loc) => loc.country);

type Props = {
  initial: SeoKpisResponse | null;
  error: string | null;
};

type SortKey = 'keyword' | 'position' | 'volume' | 'visibility';
type PositionSortKey = 'keyword' | 'position' | 'volume' | 'visibility_pct' | 'etv' | 'url';
type SortDir = 'asc' | 'desc';

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return 'Sin datos recientes';
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

function authorityScore(rank: number): number {
  if (rank <= 0) return 0;
  return Math.min(100, Math.round(rank / 10));
}

function keywordVisibility(keyword: SeoTopKeyword): number {
  if (keyword.position <= 0) return 0;
  return Math.min(100, Math.round((keyword.volume / Math.max(keyword.position, 1)) * 0.05));
}

function positionBadgeClass(position: number): string {
  if (position <= 10) return 'bg-emerald-100 text-emerald-800 ring-emerald-200';
  if (position <= 30) return 'bg-amber-100 text-amber-800 ring-amber-200';
  return 'bg-rose-100 text-rose-800 ring-rose-200';
}

function buildVisibilityChart(countryOverview: SeoCountryOverview | undefined, lastUpdated: string | null) {
  const end = lastUpdated ? new Date(lastUpdated) : new Date();
  const etv = countryOverview?.etv ?? 0;
  const keywords = countryOverview?.keywords_count ?? 0;

  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - (29 - index));
    const isToday = index === 29;
    return {
      date: date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }),
      etv: isToday ? etv : null,
      keywords: isToday ? keywords : null,
    };
  });
}

function PositionChangeIndicator({ change }: { change: number | null }) {
  if (change === null) {
    return (
      <span className="inline-flex items-center text-[10px] text-fg-muted" title="Sin histórico">
        <Minus className="h-3 w-3" />
      </span>
    );
  }
  if (change === 0) {
    return (
      <span className="inline-flex items-center text-[10px] text-fg-muted">
        <Minus className="h-3 w-3" />
      </span>
    );
  }
  const improved = change > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
        improved ? 'text-emerald-600' : 'text-rose-600'
      }`}
      title={improved ? 'Mejoró posición' : 'Perdió posición'}
    >
      {improved ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(change)}
    </span>
  );
}

function PositionTrackingSection({
  tracking,
}: {
  tracking: SeoPositionTracking;
}) {
  const [sortKey, setSortKey] = useState<PositionSortKey>('visibility_pct');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showAllKeywords, setShowAllKeywords] = useState(false);

  const sortedKeywords = useMemo(() => {
    const rows = [...tracking.top_keywords];
    rows.sort((a, b) => {
      const factor = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'keyword' || sortKey === 'url') {
        return a[sortKey].localeCompare(b[sortKey]) * factor;
      }
      return (a[sortKey] - b[sortKey]) * factor;
    });
    return rows;
  }, [sortDir, sortKey, tracking.top_keywords]);

  const visibleKeywords = showAllKeywords ? sortedKeywords : sortedKeywords.slice(0, 10);

  function toggleSort(key: PositionSortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'keyword' || key === 'url' || key === 'position' ? 'asc' : 'desc');
  }

  function sortIndicator(key: PositionSortKey): string {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const distribution = [
    { label: 'Top 3', value: tracking.keywords_top3 },
    { label: 'Top 10', value: tracking.keywords_top10 },
    { label: 'Top 20', value: tracking.keywords_top20 },
    { label: 'Top 100', value: tracking.keywords_top100 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-fg">Rastreo de Posición</h3>
          <p className="text-xs text-fg-muted">🇲🇽 México · ranked_keywords_2484</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="rounded-full border border-bg-border bg-bg-subtle px-3 py-1 text-fg-muted">
            Mejoradas:{' '}
            <span className="font-semibold text-emerald-700">
              {tracking.keywords_improved ?? 'N/D'}
            </span>
          </span>
          <span className="rounded-full border border-bg-border bg-bg-subtle px-3 py-1 text-fg-muted">
            En declive:{' '}
            <span className="font-semibold text-rose-700">
              {tracking.keywords_declined ?? 'N/D'}
            </span>
          </span>
        </div>
      </div>

      {/* A) Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Visibilidad"
          value={`${tracking.visibility}%`}
          icon={Target}
        />
        <MetricCard
          label="Tráfico estimado"
          value={tracking.estimated_traffic.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          icon={TrendingUp}
        />
        <MetricCard
          label="Posición media"
          value={tracking.avg_position.toFixed(1)}
          icon={BarChart3}
        />
        <MetricCard
          label="Keywords rastreadas"
          value={tracking.keywords_tracked.toLocaleString('es-MX')}
          icon={Search}
        />
      </div>

      {/* B) Distribution table */}
      <div className="rounded-2xl border border-bg-border bg-bg p-5 shadow-sm">
        <h4 className="mb-4 text-sm font-semibold text-fg">Distribución de rankings</h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-center text-sm">
            <thead>
              <tr className="border-b border-bg-border text-[10px] font-semibold uppercase tracking-wider text-fg-tertiary">
                {distribution.map((bucket) => (
                  <th key={bucket.label} className="pb-2 px-4">
                    {bucket.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {distribution.map((bucket) => (
                  <td key={bucket.label} className="py-3 px-4">
                    <span
                      className="text-2xl font-bold tabular-nums"
                      style={{ color: KALYO_PURPLE }}
                    >
                      {bucket.value.toLocaleString('es-MX')}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* C) Keywords table */}
      <div className="rounded-2xl border border-bg-border bg-bg p-5 shadow-sm">
        <h4 className="mb-4 text-sm font-semibold text-fg">Keywords principales</h4>
        {tracking.top_keywords.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-bg-border text-fg-tertiary">
                    {(
                      [
                        ['keyword', 'Keyword'],
                        ['position', 'Posición'],
                        ['volume', 'Vol.'],
                        ['visibility_pct', 'Visibilidad'],
                        ['etv', 'ETV'],
                        ['url', 'URL'],
                      ] as const
                    ).map(([key, label]) => (
                      <th key={key} className="pb-2 pr-4">
                        <button
                          type="button"
                          onClick={() => toggleSort(key)}
                          className="text-[10px] font-semibold uppercase tracking-wider hover:text-fg"
                        >
                          {label}
                          {sortIndicator(key)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleKeywords.map((row: SeoPositionTrackingKeyword) => (
                    <tr
                      key={`${row.keyword}-${row.url}`}
                      className="border-b border-bg-border/60 hover:bg-bg-subtle/50"
                    >
                      <td className="py-2.5 pr-4 font-medium text-fg">{row.keyword}</td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ring-1 ${positionBadgeClass(row.position)}`}
                          >
                            #{row.position}
                          </span>
                          <PositionChangeIndicator change={row.position_change} />
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums text-fg">
                        {row.volume.toLocaleString('es-MX')}
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-bg-subtle">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${row.visibility_pct}%`,
                                backgroundColor: KALYO_PURPLE,
                              }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-fg-muted">
                            {row.visibility_pct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums text-fg">
                        {row.etv.toLocaleString('es-MX', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="max-w-[220px] truncate py-2.5 pr-4 text-xs text-fg-muted">
                        {row.url ? (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-fg hover:underline"
                            title={row.url}
                          >
                            {row.url.replace(/^https?:\/\/(www\.)?/, '')}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sortedKeywords.length > 10 ? (
              <button
                type="button"
                onClick={() => setShowAllKeywords((prev) => !prev)}
                className="mt-3 text-xs font-semibold hover:underline"
                style={{ color: KALYO_PURPLE }}
              >
                {showAllKeywords ? 'Ver menos' : `Ver todas (${sortedKeywords.length})`}
              </button>
            ) : null}
          </>
        ) : (
          <KpiEmptyState description="Sin keywords rankeadas en México" />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* D) Pages */}
        <div className="rounded-2xl border border-bg-border bg-bg p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4" style={{ color: KALYO_PURPLE }} />
            <h4 className="text-sm font-semibold text-fg">Páginas</h4>
          </div>
          {tracking.pages.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-bg-border text-[10px] font-semibold uppercase tracking-wider text-fg-tertiary">
                    <th className="pb-2 pr-4">URL</th>
                    <th className="pb-2 pr-4">Keywords</th>
                    <th className="pb-2 pr-4">Posición media</th>
                    <th className="pb-2 pr-4">Tráfico est.</th>
                  </tr>
                </thead>
                <tbody>
                  {tracking.pages.map((page) => (
                    <tr
                      key={page.url}
                      className="border-b border-bg-border/60 hover:bg-bg-subtle/50"
                    >
                      <td className="max-w-[200px] truncate py-2.5 pr-4 text-xs">
                        {page.url.startsWith('http') ? (
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-fg hover:underline"
                            title={page.url}
                          >
                            {page.url.replace(/^https?:\/\/(www\.)?kalyo\.io/, '') || '/'}
                          </a>
                        ) : (
                          <span className="text-fg-muted">{page.url}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums">{page.keywords_count}</td>
                      <td className="py-2.5 pr-4 tabular-nums">{page.avg_position.toFixed(1)}</td>
                      <td className="py-2.5 pr-4 tabular-nums">
                        {page.estimated_traffic.toLocaleString('es-MX', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <KpiEmptyState description="Sin páginas con keywords rankeadas" />
          )}
        </div>

        {/* E) Competitors mini table */}
        <div className="rounded-2xl border border-bg-border bg-bg p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: KALYO_PURPLE }} />
            <h4 className="text-sm font-semibold text-fg">Competidores</h4>
          </div>
          {tracking.competitors_visibility.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-bg-border text-[10px] font-semibold uppercase tracking-wider text-fg-tertiary">
                    <th className="pb-2 pr-4">Dominio</th>
                    <th className="pb-2 pr-4">Keywords comunes</th>
                    <th className="pb-2 pr-4">ETV est.</th>
                    <th className="pb-2 pr-4">Visibilidad aprox.</th>
                  </tr>
                </thead>
                <tbody>
                  {tracking.competitors_visibility.map((row, index) => (
                    <tr
                      key={row.domain}
                      className="border-b border-bg-border/60 hover:bg-bg-subtle/50"
                    >
                      <td className="py-2.5 pr-4">
                        <span className="font-medium text-fg">{row.domain}</span>
                        {index === 0 ? (
                          <span
                            className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                            style={{ backgroundColor: KALYO_PURPLE }}
                          >
                            Top
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums">
                        {row.common_keywords.toLocaleString('es-MX')}
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums">
                        {row.etv.toLocaleString('es-MX')}
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-bg-subtle">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${row.visibility_approx}%`,
                                backgroundColor: KALYO_PURPLE,
                              }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-fg-muted">
                            {row.visibility_approx}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <KpiEmptyState description="Sin datos de competidores en caché" />
          )}
        </div>
      </div>
    </div>
  );
}

function ChangeIndicator({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-fg-muted">
        <Minus className="h-3 w-3" />
        N/D
      </span>
    );
  }
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-fg-muted">
        <Minus className="h-3 w-3" />
        0%
      </span>
    );
  }
  const positive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        positive ? 'text-emerald-600' : 'text-rose-600'
      }`}
    >
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {positive ? '+' : ''}
      {value}%
    </span>
  );
}

function healthColor(score: number): string {
  if (score >= 90) return '#10B981';
  if (score >= 70) return '#F59E0B';
  return '#EF4444';
}

function SiteHealthGauge({ score }: { score: number }) {
  const radius = 70;
  const circumference = Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = healthColor(score);

  return (
    <div className="relative mx-auto flex h-36 w-44 items-end justify-center">
      <svg viewBox="0 0 160 90" className="h-full w-full overflow-visible">
        <path
          d="M 12 78 A 68 68 0 0 1 148 78"
          fill="none"
          stroke="#E9E5F5"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 12 78 A 68 68 0 0 1 148 78"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute bottom-0 text-center">
        <p className="text-4xl font-bold tabular-nums" style={{ color }}>
          {score}
        </p>
        <p className="text-xs font-medium text-fg-muted">Site Health</p>
      </div>
    </div>
  );
}

function ThematicScoreCard({ label, score }: { label: string; score: number }) {
  const color = healthColor(score);
  return (
    <div className="rounded-xl border border-bg-border bg-bg p-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums" style={{ color }}>
        {score}%
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-subtle">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function vitalsCardClass(status: VitalsStatus): string {
  if (status === 'good') return 'border-emerald-200 bg-emerald-50';
  if (status === 'needs-improvement') return 'border-amber-200 bg-amber-50';
  return 'border-rose-200 bg-rose-50';
}

function vitalsTextClass(status: VitalsStatus): string {
  if (status === 'good') return 'text-emerald-700';
  if (status === 'needs-improvement') return 'text-amber-700';
  return 'text-rose-700';
}

function SiteAuditSections({
  audit,
  pagespeed,
}: {
  audit: SeoSiteAudit | null | undefined;
  pagespeed: SeoPageSpeedSummary | null | undefined;
}) {
  if (!audit) {
    return (
      <div className="rounded-2xl border border-dashed border-bg-border bg-bg-subtle p-6 text-center">
        <p className="text-sm font-medium text-fg">Site Audit no disponible</p>
        <p className="mt-1 text-xs text-fg-muted">
          Pulsa Refrescar para iniciar el crawl On-Page de DataForSEO.
        </p>
      </div>
    );
  }

  if (audit.status === 'pending') {
    return (
      <div className="rounded-2xl border border-bg-border bg-bg p-6">
        <div className="animate-pulse space-y-4">
          <div className="mx-auto h-28 w-44 rounded-full bg-bg-subtle" />
          <p className="text-center text-sm font-medium text-fg">
            Análisis en proceso, disponible mañana
          </p>
          <p className="text-center text-xs text-fg-muted">
            El crawl On-Page de kalyo.io fue encolado. Los resultados aparecerán en la próxima
            sincronización.
          </p>
        </div>
      </div>
    );
  }

  const warnings = [
    { label: 'JS/CSS sin minificar', count: audit.js_css_not_minified },
    { label: 'Enlaces externos rotos', count: audit.broken_links },
    { label: 'Bajo número de palabras', count: audit.low_word_count },
    { label: 'Páginas con 1 solo enlace interno', count: audit.single_internal_link_pages },
    { label: 'Contenido sin optimizar', count: audit.unoptimized_content },
  ].filter((item) => item.count > 0);

  const lcpStatusValue = pagespeed ? lcpStatus(pagespeed.lcp) : 'needs-improvement';
  const clsStatusValue = pagespeed ? clsStatus(pagespeed.cls) : 'needs-improvement';
  const tbtStatusValue = pagespeed ? tbtStatus(pagespeed.tbt) : 'needs-improvement';

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-bg-border bg-bg p-5 shadow-sm">
          <h3 className="mb-3 text-base font-semibold text-fg">Site Health</h3>
          <SiteHealthGauge score={audit.site_health} />
          {audit.status === 'in_progress' ? (
            <p className="mt-2 text-center text-xs text-amber-700">
              Crawl en progreso ({audit.pages_crawled} páginas)
            </p>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg bg-emerald-50 px-2 py-2 text-emerald-800">
              <p className="font-bold tabular-nums">{audit.pages_ok}</p>
              <p>Correctas</p>
            </div>
            <div className="rounded-lg bg-amber-50 px-2 py-2 text-amber-800">
              <p className="font-bold tabular-nums">{audit.pages_with_issues}</p>
              <p>Con problemas</p>
            </div>
            <div className="rounded-lg bg-sky-50 px-2 py-2 text-sky-800">
              <p className="font-bold tabular-nums">{audit.pages_redirected}</p>
              <p>Redirigidas</p>
            </div>
            <div className="rounded-lg bg-rose-50 px-2 py-2 text-rose-800">
              <p className="font-bold tabular-nums">{audit.pages_blocked}</p>
              <p>Bloqueadas</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-bg-border bg-bg p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-fg">Puntuación temática</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ThematicScoreCard label="Rastreabilidad" score={audit.crawlability_score} />
            <ThematicScoreCard label="HTTPS" score={audit.https_score} />
            <ThematicScoreCard label="SEO Internacional" score={audit.international_seo_score} />
            <ThematicScoreCard
              label="Rendimiento"
              score={pagespeed?.performance_mobile ?? audit.performance_score}
            />
            <ThematicScoreCard label="Enlaces internos" score={audit.internal_links_score} />
            <ThematicScoreCard label="Marcado" score={audit.markup_score} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-bg-border bg-bg p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-fg">Advertencias principales</h3>
          {warnings.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {warnings.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-3 py-2"
                >
                  <span>
                    ⚠️ {item.label}
                  </span>
                  <span className="font-bold tabular-nums text-amber-800">{item.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">Sin advertencias críticas detectadas.</p>
          )}
        </div>

        <div className="rounded-2xl border border-bg-border bg-bg p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-fg">Core Web Vitals · kalyo.io mobile</h3>
          {pagespeed ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className={`rounded-xl border p-4 ${vitalsCardClass(lcpStatusValue)}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">LCP</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${vitalsTextClass(lcpStatusValue)}`}>
                  {pagespeed.lcp.toFixed(1)}s
                </p>
              </div>
              <div className={`rounded-xl border p-4 ${vitalsCardClass(clsStatusValue)}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">CLS</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${vitalsTextClass(clsStatusValue)}`}>
                  {pagespeed.cls.toFixed(3)}
                </p>
              </div>
              <div className={`rounded-xl border p-4 ${vitalsCardClass(tbtStatusValue)}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">TBT</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${vitalsTextClass(tbtStatusValue)}`}>
                  {pagespeed.tbt}ms
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-fg-muted">
              PageSpeed pendiente. Requiere PAGESPEED_API_KEY en el próximo sync.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthorityGauge({ score }: { score: number }) {
  const radius = 42;
  const circumference = Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex h-24 w-24 items-end justify-center">
      <svg viewBox="0 0 100 56" className="h-full w-full overflow-visible">
        <path
          d="M 8 50 A 42 42 0 0 1 92 50"
          fill="none"
          stroke="#E9E5F5"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 8 50 A 42 42 0 0 1 92 50"
          fill="none"
          stroke={KALYO_PURPLE}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute bottom-0 text-2xl font-bold tabular-nums text-fg">{score}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  change,
  icon: Icon,
  children,
}: {
  label: string;
  value: string;
  change?: number | null;
  icon: typeof Search;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-bg-border bg-bg p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-fg">{value}</p>
          {change !== undefined ? (
            <div className="mt-1">
              <ChangeIndicator value={change ?? null} />
            </div>
          ) : null}
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${KALYO_PURPLE}18`, color: KALYO_PURPLE }}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      </div>
      {children ? <div className="mt-3 border-t border-bg-border pt-3">{children}</div> : null}
    </div>
  );
}

function VisibilityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | null; name?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-bg-border bg-bg px-3 py-2 shadow-lg">
      <p className="mb-1 text-[10px] font-medium uppercase text-fg-tertiary">{label}</p>
      {payload.map((entry) =>
        entry.value != null ? (
          <p key={entry.name} className="text-sm font-medium tabular-nums" style={{ color: entry.color }}>
            {entry.name}: {entry.value.toLocaleString('es-MX')}
          </p>
        ) : null,
      )}
    </div>
  );
}

export function SeoDashboard({ initial, error: initialError }: Props) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [country, setCountry] = useState<string>('MX');
  const [sortKey, setSortKey] = useState<SortKey>('position');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [chartMetric, setChartMetric] = useState<'etv' | 'keywords'>('etv');

  const countryOverview = useMemo(
    () => data?.overview.find((row) => row.country === country),
    [country, data?.overview],
  );

  const chartData = useMemo(
    () => buildVisibilityChart(countryOverview, data?.last_updated ?? null),
    [countryOverview, data?.last_updated],
  );

  const sortedKeywords = useMemo(() => {
    const rows = (data?.top_keywords ?? []).filter((row) => row.country === country);
    const enriched = rows.map((row) => ({ ...row, visibility: keywordVisibility(row) }));
    enriched.sort((a, b) => {
      const factor = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'keyword') return a.keyword.localeCompare(b.keyword) * factor;
      return (a[sortKey] - b[sortKey]) * factor;
    });
    return enriched;
  }, [country, data?.top_keywords, sortDir, sortKey]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const syncRes = await fetch('/api/admin/seo/refresh', { method: 'POST' });
      const syncJson = (await syncRes.json()) as {
        error?: string;
        updated?: string[];
        errors?: Array<{ key: string; error: string }>;
      };
      if (!syncRes.ok) throw new Error(syncJson.error ?? 'Error al sincronizar SEO');

      const res = await fetch('/api/kpis/seo');
      const json = (await res.json()) as SeoKpisResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar SEO');
      setData(json);

      const updatedCount = syncJson.updated?.length ?? 0;
      const errorCount = syncJson.errors?.length ?? 0;
      if (errorCount > 0) {
        setSuccessMessage(
          `Sync parcial: ${updatedCount} claves actualizadas, ${errorCount} con error.`,
        );
      } else {
        setSuccessMessage(`SEO actualizado correctamente (${updatedCount} claves).`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'keyword' ? 'asc' : key === 'position' ? 'asc' : 'desc');
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const authority = authorityScore(data?.backlinks?.rank ?? 0);
  const hasData = Boolean(data && data.overview.length > 0);

  return (
    <AdminShell title="SEO Intelligence" subtitle="Monitoreo orgánico · DataForSEO">
      <div className="space-y-6">
        {/* Header SEMrush-style */}
        <div className="rounded-2xl border border-bg-border bg-gradient-to-br from-[#7C3DE3]/8 via-bg to-bg p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-md"
                  style={{ backgroundColor: KALYO_PURPLE }}
                >
                  <Globe2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-fg">kalyo.io</h2>
                  <p className="text-sm text-fg-muted">Dominio principal · Latinoamérica + España</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-fg-muted">
                Última actualización:{' '}
                <span className="font-medium text-fg">{formatUpdatedAt(data?.last_updated ?? null)}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1 rounded-full border border-bg-border bg-bg p-1">
                {COUNTRIES.map((code) => {
                  const meta = SEO_COUNTRIES.find((loc) => loc.country === code);
                  const active = country === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setCountry(code)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        active ? 'text-white shadow-sm' : 'text-fg-muted hover:text-fg'
                      }`}
                      style={active ? { backgroundColor: KALYO_PURPLE } : undefined}
                      title={meta?.label}
                    >
                      {meta?.flag} {code}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: KALYO_PURPLE }}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Actualizando…' : 'Refrescar'}
              </button>
            </div>
          </div>
        </div>

        {successMessage ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {successMessage}
          </div>
        ) : null}

        {error ? <KpiSectionError title="SEO kalyo.io" error={error} /> : null}

        {!data?.configured ? (
          <KpiSectionError
            title="DataForSEO"
            error="Configura DATAFORSEO_LOGIN y DATAFORSEO_PASSWORD en Vercel (proyecto botio)."
          />
        ) : null}

        {!hasData && !error ? (
          <KpiEmptyState description="El cron diario poblará la caché SEO. También puedes ejecutar /api/cron/seo-sync manualmente." />
        ) : null}

        {hasData && countryOverview ? (
          <>
            {/* Metric cards row */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-bg-border bg-bg p-4 shadow-sm xl:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Authority Score</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <AuthorityGauge score={authority} />
                  <div className="text-right">
                    <p className="text-xs text-fg-muted">Domain rank</p>
                    <p className="text-lg font-bold tabular-nums">{data?.backlinks?.rank ?? '—'}</p>
                  </div>
                </div>
              </div>

              <MetricCard
                label="Tráfico orgánico (ETV)"
                value={countryOverview.etv.toLocaleString('es-MX')}
                change={null}
                icon={TrendingUp}
              />
              <MetricCard
                label="Keywords orgánicas"
                value={countryOverview.keywords_count.toLocaleString('es-MX')}
                change={null}
                icon={Search}
              />
              <MetricCard
                label="Dominios de referencia"
                value={(data?.backlinks?.referring_domains ?? 0).toLocaleString('es-MX')}
                icon={Link2}
              />
              <MetricCard
                label="Backlinks totales"
                value={(data?.backlinks?.total ?? 0).toLocaleString('es-MX')}
                icon={Globe2}
              />
            </div>

            {data?.position_tracking ? (
              <div className="rounded-2xl border border-bg-border bg-bg p-5 shadow-sm">
                <PositionTrackingSection tracking={data.position_tracking} />
              </div>
            ) : null}

            <SiteAuditSections audit={data?.site_audit} pagespeed={data?.pagespeed} />

            {/* Visibility chart */}
            <div className="rounded-2xl border border-bg-border bg-bg p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-fg">Visibilidad en el tiempo</h3>
                  <p className="text-xs text-fg-muted">
                    {countryOverview.flag} {countryOverview.label} · últimos 30 días
                  </p>
                </div>
                <div className="flex gap-1 rounded-full border border-bg-border bg-bg-subtle p-1">
                  {(['etv', 'keywords'] as const).map((metric) => (
                    <button
                      key={metric}
                      type="button"
                      onClick={() => setChartMetric(metric)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        chartMetric === metric ? 'text-white' : 'text-fg-muted hover:text-fg'
                      }`}
                      style={chartMetric === metric ? { backgroundColor: KALYO_PURPLE } : undefined}
                    >
                      {metric === 'etv' ? 'ETV' : 'Keywords'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="seoVisibilityFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={KALYO_PURPLE} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={KALYO_PURPLE} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip content={<VisibilityTooltip />} />
                    <Area
                      type="monotone"
                      dataKey={chartMetric}
                      name={chartMetric === 'etv' ? 'ETV' : 'Keywords'}
                      stroke={KALYO_PURPLE}
                      strokeWidth={2.5}
                      fill="url(#seoVisibilityFill)"
                      connectNulls={false}
                      dot={{ r: 3, fill: KALYO_PURPLE, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: KALYO_PURPLE }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-fg-muted">
                El histórico completo se acumulará con cada sync diario del cron. Por ahora se muestra el snapshot
                más reciente.
              </p>
            </div>

            {/* Keywords table */}
            <div className="rounded-2xl border border-bg-border bg-bg p-5 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-fg">
                Keywords principales · {countryOverview.flag} {country}
              </h3>
              {sortedKeywords.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-bg-border text-fg-tertiary">
                        {(
                          [
                            ['keyword', 'Keyword'],
                            ['position', 'Posición'],
                            ['volume', 'Volumen'],
                            ['visibility', 'Visibilidad'],
                          ] as const
                        ).map(([key, label]) => (
                          <th key={key} className="pb-2 pr-4">
                            <button
                              type="button"
                              onClick={() => toggleSort(key)}
                              className="text-[10px] font-semibold uppercase tracking-wider hover:text-fg"
                            >
                              {label}
                              {sortIndicator(key)}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedKeywords.map((row) => (
                        <tr
                          key={`${row.country}-${row.keyword}-${row.position}`}
                          className="border-b border-bg-border/60 hover:bg-bg-subtle/50"
                        >
                          <td className="py-2.5 pr-4 font-medium text-fg">{row.keyword}</td>
                          <td className="py-2.5 pr-4">
                            <span
                              className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ring-1 ${positionBadgeClass(row.position)}`}
                            >
                              #{row.position}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 tabular-nums text-fg">
                            {row.volume.toLocaleString('es-MX')}
                          </td>
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-bg-subtle">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${row.visibility}%`,
                                    backgroundColor: KALYO_PURPLE,
                                  }}
                                />
                              </div>
                              <span className="text-xs tabular-nums text-fg-muted">{row.visibility}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <KpiEmptyState description={`Sin keywords rankeadas para ${country}`} />
              )}
            </div>

            {/* Bottom row */}
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-bg-border bg-bg p-5 shadow-sm lg:col-span-2">
                <h3 className="mb-4 text-base font-semibold text-fg">Competidores · México</h3>
                {data?.competitors.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-bg-border text-[10px] font-semibold uppercase tracking-wider text-fg-tertiary">
                          <th className="pb-2 pr-4">Dominio</th>
                          <th className="pb-2 pr-4">Keywords comunes</th>
                          <th className="pb-2 pr-4">ETV estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.competitors.map((row, index) => (
                          <tr
                            key={row.domain}
                            className="border-b border-bg-border/60 hover:bg-bg-subtle/50"
                          >
                            <td className="py-2.5 pr-4">
                              <span className="font-medium text-fg">{row.domain}</span>
                              {index === 0 ? (
                                <span
                                  className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                                  style={{ backgroundColor: KALYO_PURPLE }}
                                >
                                  Top
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2.5 pr-4 tabular-nums">
                              {row.common_keywords.toLocaleString('es-MX')}
                            </td>
                            <td className="py-2.5 pr-4 tabular-nums">{row.etv.toLocaleString('es-MX')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <KpiEmptyState description="Sin datos de competidores en caché" />
                )}
              </div>

              <div className="rounded-2xl border border-bg-border bg-bg p-5 shadow-sm">
                <h3 className="mb-4 text-base font-semibold text-fg">Perfil de backlinks</h3>
                <div className="space-y-4">
                  <div className="rounded-xl bg-bg-subtle p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                      Dominios referentes
                    </p>
                    <p className="mt-1 text-3xl font-bold tabular-nums" style={{ color: KALYO_PURPLE }}>
                      {(data?.backlinks?.referring_domains ?? 0).toLocaleString('es-MX')}
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center justify-between border-b border-bg-border/60 pb-2">
                      <span className="text-fg-muted">Backlinks totales</span>
                      <span className="font-semibold tabular-nums">
                        {(data?.backlinks?.total ?? 0).toLocaleString('es-MX')}
                      </span>
                    </li>
                    <li className="flex items-center justify-between border-b border-bg-border/60 pb-2">
                      <span className="text-fg-muted">Domain rank</span>
                      <span className="font-semibold tabular-nums">{data?.backlinks?.rank ?? '—'}</span>
                    </li>
                    <li className="flex items-center justify-between pb-2">
                      <span className="text-fg-muted">Posición promedio ({country})</span>
                      <span className="font-semibold tabular-nums">
                        {countryOverview.avg_position ?? '—'}
                      </span>
                    </li>
                  </ul>
                  <div className="rounded-xl border border-dashed border-bg-border p-3">
                    <p className="text-xs font-semibold text-fg-muted">Top referentes y anchor texts</p>
                    <p className="mt-1 text-xs text-fg-tertiary">
                      Disponible en una próxima iteración con endpoints de backlinks detallados de DataForSEO.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}
