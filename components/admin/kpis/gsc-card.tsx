'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, MousePointerClick, Search, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { GscMetrics, GscPeriodDays } from '@/lib/gsc-types';
import { GSC_PERIOD_OPTIONS } from '@/lib/gsc-types';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiVividMetric } from '@/components/admin/kpis/vivid/kpi-vivid-metric';
import { KpiVividPanel } from '@/components/admin/kpis/vivid/kpi-vivid-panel';
import { KpiVividLineChart } from '@/components/admin/kpis/vivid/kpi-vivid-charts';
import { KpiVividTable } from '@/components/admin/kpis/vivid/kpi-vivid-table';

function positionClass(position: number): string {
  if (position < 10) return 'font-semibold text-emerald-600';
  if (position <= 20) return 'font-semibold text-amber-600';
  return 'font-semibold text-rose-600';
}

function positionAccent(position: number): 'emerald' | 'amber' | 'rose' {
  if (position < 10) return 'emerald';
  if (position <= 20) return 'amber';
  return 'rose';
}

function shortenPageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path.startsWith('/articulos/')) return path;
    return path || url;
  } catch {
    return url;
  }
}

function PeriodSelect({
  value,
  onChange,
  disabled,
}: {
  value: GscPeriodDays;
  onChange: (period: GscPeriodDays) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) as GscPeriodDays)}
        className={cn(
          'appearance-none rounded-lg border border-bg-border bg-bg py-1.5 pl-3 pr-8 text-xs font-semibold text-fg shadow-sm',
          'transition hover:border-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
          disabled && 'cursor-not-allowed opacity-60',
        )}
        aria-label="Periodo de Search Console"
      >
        {GSC_PERIOD_OPTIONS.map((days) => (
          <option key={days} value={days}>
            {days} días
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
    </div>
  );
}

export function GscCard() {
  const [period, setPeriod] = useState<GscPeriodDays>(28);
  const [data, setData] = useState<GscMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/gsc?days=${period}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<GscMetrics>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [period]);

  const sparkData = useMemo(
    () =>
      (data?.daily_clicks ?? []).map((row) => ({
        date: row.date.slice(5),
        clicks: row.clicks,
      })),
    [data?.daily_clicks],
  );

  const headerAction = (
    <div className="flex flex-wrap items-center gap-2">
      <PeriodSelect value={period} onChange={setPeriod} disabled={loading} />
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
        <Search className="h-3 w-3" />
        kalyo.io
      </span>
    </div>
  );

  if (loading && !data) {
    return (
      <KpiVividPanel
        title="Google Search Console"
        subtitle="Cargando…"
        accent="emerald"
        action={headerAction}
      >
        <KpiEmptyState description="Cargando datos de Search Console…" />
      </KpiVividPanel>
    );
  }

  if (error && !data) {
    return <KpiSectionError title="Google Search Console" error={error} />;
  }

  if (!data) {
    return (
      <KpiVividPanel title="Google Search Console" accent="emerald" action={headerAction}>
        <KpiEmptyState description="Sin datos de Search Console" />
      </KpiVividPanel>
    );
  }

  const hasActivity =
    data.clicks > 0 ||
    data.impressions > 0 ||
    data.top_queries.length > 0 ||
    data.top_pages.length > 0;

  return (
    <KpiVividPanel
      title="Google Search Console"
      subtitle={`Últimos ${period} días · métricas, queries, páginas y sparkline`}
      accent="emerald"
      action={headerAction}
    >
      {error ? <KpiSectionError title="Error al actualizar periodo" error={error} /> : null}

      {loading ? (
        <p className="mb-3 text-xs text-fg-muted">Actualizando periodo…</p>
      ) : null}

      {!hasActivity ? (
        <KpiEmptyState description="La API respondió pero no hay clicks/impresiones en el periodo." />
      ) : (
        <>
          <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', loading && 'opacity-60')}>
            <KpiVividMetric
              label="Clicks"
              value={data.clicks.toLocaleString()}
              icon={MousePointerClick}
              accent="emerald"
              compact
              hint={`${period}d`}
            />
            <KpiVividMetric
              label="Impresiones"
              value={data.impressions.toLocaleString()}
              icon={Search}
              accent="sky"
              compact
              hint={`${period}d`}
            />
            <KpiVividMetric
              label="CTR"
              value={`${data.ctr.toFixed(2)}%`}
              icon={TrendingDown}
              accent="violet"
              compact
              hint={`${period}d`}
            />
            <KpiVividMetric
              label="Posición promedio"
              value={`#${data.position.toFixed(1)}`}
              icon={Search}
              accent={positionAccent(data.position)}
              compact
              hint={`${period}d`}
            />
          </div>

          {sparkData.length > 0 ? (
            <div className={cn('mt-5', loading && 'opacity-60')}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-fg-tertiary">
                Clicks diarios · {period} días
              </p>
              <KpiVividLineChart
                data={sparkData}
                xKey="date"
                series={[{ dataKey: 'clicks', name: 'Clicks', color: '#10B981' }]}
                height={140}
              />
            </div>
          ) : null}

          <div className={cn('mt-5 grid gap-4 xl:grid-cols-2', loading && 'opacity-60')}>
            <div>
              <p className="mb-2 text-xs font-semibold text-fg-muted">Top 5 queries ({period}d)</p>
              {data.top_queries.length > 0 ? (
                <KpiVividTable
                  rows={data.top_queries}
                  rowKey={(row) => row.query}
                  columns={[
                    {
                      key: 'query',
                      header: 'Query',
                      render: (row) => (
                        <span className="block max-w-[180px] truncate">{row.query}</span>
                      ),
                    },
                    {
                      key: 'clicks',
                      header: 'Clicks',
                      render: (row) => (
                        <span className="tabular-nums">{row.clicks.toLocaleString()}</span>
                      ),
                    },
                    {
                      key: 'position',
                      header: 'Posición',
                      render: (row) => (
                        <span className={cn('tabular-nums', positionClass(row.position))}>
                          #{row.position.toFixed(1)}
                        </span>
                      ),
                    },
                  ]}
                />
              ) : (
                <p className="text-sm text-fg-muted">Sin queries en el periodo.</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-fg-muted">Top 5 páginas ({period}d)</p>
              {data.top_pages.length > 0 ? (
                <KpiVividTable
                  rows={data.top_pages}
                  rowKey={(row) => row.page}
                  columns={[
                    {
                      key: 'page',
                      header: 'Página',
                      render: (row) => (
                        <span className="block max-w-[200px] truncate font-mono text-xs">
                          {shortenPageUrl(row.page)}
                        </span>
                      ),
                    },
                    {
                      key: 'clicks',
                      header: 'Clicks',
                      render: (row) => (
                        <span className="tabular-nums">{row.clicks.toLocaleString()}</span>
                      ),
                    },
                    {
                      key: 'position',
                      header: 'Posición',
                      render: (row) => (
                        <span className={cn('tabular-nums', positionClass(row.position))}>
                          #{row.position.toFixed(1)}
                        </span>
                      ),
                    },
                  ]}
                />
              ) : (
                <p className="text-sm text-fg-muted">Sin páginas en el periodo.</p>
              )}
            </div>
          </div>

          <p className="mt-4 text-xs text-fg-muted">
            Search Console API · Actualizado {new Date(data.updated_at).toLocaleString('es-MX')} · caché 1h
          </p>
        </>
      )}
    </KpiVividPanel>
  );
}
