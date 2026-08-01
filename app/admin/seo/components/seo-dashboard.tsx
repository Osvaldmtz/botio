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
  Globe2,
  Link2,
  Minus,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/admin-shell';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import type { SeoCountryOverview, SeoKpisResponse, SeoTopKeyword } from '@/lib/dataforseo-api';

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
    try {
      const res = await fetch('/api/kpis/seo');
      const json = (await res.json()) as SeoKpisResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar SEO');
      setData(json);
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
