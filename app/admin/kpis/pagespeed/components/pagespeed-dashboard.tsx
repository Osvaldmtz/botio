'use client';

import { useState } from 'react';
import { Gauge, RefreshCw } from 'lucide-react';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiLayout } from '@/components/admin/kpis/kpi-layout';
import { KpiVividLineChart } from '@/components/admin/kpis/vivid/kpi-vivid-charts';
import { KpiVividMetric } from '@/components/admin/kpis/vivid/kpi-vivid-metric';
import { KpiVividPanel } from '@/components/admin/kpis/vivid/kpi-vivid-panel';
import { KpiVividTable } from '@/components/admin/kpis/vivid/kpi-vivid-table';
import type { PageSpeedHistoryRow, PageSpeedMetrics } from '@/lib/pagespeed-utils';
import {
  clsStatus,
  fcpStatus,
  lcpStatus,
  performanceAccent,
  tbtStatus,
  vitalsStatusLabel,
} from '@/lib/pagespeed-utils';

type Props = {
  initial: PageSpeedMetrics | null;
  history: PageSpeedHistoryRow[];
  error: string | null;
};

function ScoreCard({
  label,
  score,
  hint,
}: {
  label: string;
  score: number;
  hint?: string;
}) {
  return (
    <KpiVividMetric
      label={label}
      value={String(score)}
      hint={hint}
      icon={Gauge}
      accent={performanceAccent(score)}
      compact
    />
  );
}

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function PageSpeedDashboard({ initial, history, error: initialError }: Props) {
  const [metrics, setMetrics] = useState(initial);
  const [error, setError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/kpis/pagespeed?refresh=1');
      const json = (await res.json()) as PageSpeedMetrics & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error al actualizar PageSpeed');
      setMetrics(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }

  const chartData = history.map((row) => ({
    date: row.date.slice(5),
    performance: row.performance_mobile ?? 0,
    seo: row.seo_mobile ?? 0,
  }));

  const vitalsRows = metrics
    ? [
        {
          metric: 'LCP',
          value: `${metrics.landing_mobile.lcp.toFixed(1)} sec`,
          status: lcpStatus(metrics.landing_mobile.lcp),
        },
        {
          metric: 'FCP',
          value: `${metrics.landing_mobile.fcp.toFixed(1)} sec`,
          status: fcpStatus(metrics.landing_mobile.fcp),
        },
        {
          metric: 'TBT',
          value: `${metrics.landing_mobile.tbt} ms`,
          status: tbtStatus(metrics.landing_mobile.tbt),
        },
        {
          metric: 'CLS',
          value: metrics.landing_mobile.cls.toFixed(3),
          status: clsStatus(metrics.landing_mobile.cls),
        },
      ]
    : [];

  return (
    <KpiLayout title="PageSpeed — Core Web Vitals" subtitle="Google PageSpeed Insights · Actualizado cada 12h">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-fg-muted">
            {metrics?.updated_at
              ? `Última actualización: ${formatUpdatedAt(metrics.updated_at)}`
              : 'Sin datos recientes'}
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-full bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Actualizando…' : 'Actualizar ahora'}
          </button>
        </div>

        {error ? <KpiSectionError title="PageSpeed Insights" error={error} /> : null}

        {!metrics && !error ? (
          <KpiEmptyState description="Pulsa «Actualizar ahora» para obtener scores (puede tardar ~40s)" />
        ) : null}

        {metrics ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ScoreCard label="kalyo.io mobile" score={metrics.landing_mobile.performance} />
              <ScoreCard label="kalyo.io desktop" score={metrics.landing_desktop.performance} />
              <ScoreCard
                label="Artículo PHQ-9 mobile"
                score={metrics.article_mobile.performance}
                hint={`LCP ${metrics.article_mobile.lcp.toFixed(1)}s`}
              />
              <ScoreCard
                label="app.kalyo.io mobile"
                score={metrics.app_mobile.performance}
                hint={`LCP ${metrics.app_mobile.lcp.toFixed(1)}s`}
              />
            </div>

            <KpiVividPanel title="Lighthouse — kalyo.io" accent="violet">
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-muted">Mobile</p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <ScoreCard label="Performance" score={metrics.landing_mobile.performance} />
                    <ScoreCard label="SEO" score={metrics.landing_mobile.seo} />
                    <ScoreCard label="Accessibility" score={metrics.landing_mobile.accessibility} />
                    <ScoreCard label="Best Practices" score={metrics.landing_mobile.best_practices} />
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-muted">Desktop</p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <ScoreCard label="Performance" score={metrics.landing_desktop.performance} />
                    <ScoreCard label="SEO" score={metrics.landing_desktop.seo} />
                    <ScoreCard label="Accessibility" score={metrics.landing_desktop.accessibility} />
                    <ScoreCard label="Best Practices" score={metrics.landing_desktop.best_practices} />
                  </div>
                </div>
              </div>
            </KpiVividPanel>

            <KpiVividPanel title="Core Web Vitals — kalyo.io mobile" accent="sky">
              <KpiVividTable
                rows={vitalsRows}
                rowKey={(row) => row.metric}
                columns={[
                  { key: 'metric', header: 'Metric', render: (row) => row.metric },
                  { key: 'value', header: 'Value', render: (row) => <span className="tabular-nums">{row.value}</span> },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (row) => vitalsStatusLabel(row.status),
                  },
                ]}
              />
            </KpiVividPanel>

            <KpiVividPanel title="Performance & SEO mobile — últimos 30 días" accent="emerald">
              {chartData.length > 0 ? (
                <KpiVividLineChart
                  data={chartData}
                  xKey="date"
                  series={[
                    { dataKey: 'performance', name: 'Performance', color: '#10B981' },
                    { dataKey: 'seo', name: 'SEO', color: '#8B5CF6' },
                  ]}
                  height={240}
                />
              ) : (
                <KpiEmptyState description="El cron diario empezará a llenar el historial" />
              )}
            </KpiVividPanel>
          </>
        ) : null}
      </div>
    </KpiLayout>
  );
}
