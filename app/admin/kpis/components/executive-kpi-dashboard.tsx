'use client';

import type { ExecutiveSummaryData } from '@/lib/kpi/utils';
import { KpiLayout } from '@/components/admin/kpis/kpi-layout';
import { KpiMetricCard } from '@/components/admin/kpis/kpi-metric-card';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiLineChart } from '@/components/admin/kpis/kpi-charts';
import { RealtimeWidget } from '@/components/admin/kpis/realtime-widget';

function fmtUsd(value: number | null | undefined): string {
  if (value == null) return '—';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtNum(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('en-US');
}

type Props = {
  data: ExecutiveSummaryData;
};

export function ExecutiveKpiDashboard({ data }: Props) {
  const waTotal = data.twilio.reduce((sum, r) => sum + (r.total_sent ?? 0), 0);
  const hasAnyData =
    data.kalyo != null ||
    data.twilio.length > 0 ||
    data.igReachDaily.length > 0 ||
    data.landingDaily.length > 0;

  const mrrChart = data.kalyoHistory.map((row) => ({
    date: row.date.slice(5),
    mrr: Number(row.mrr ?? 0),
  }));

  const igChart = data.igReachDaily.map((row) => ({
    date: row.date.slice(5),
    reach: row.reach,
  }));

  const waByDate = new Map<string, number>();
  for (const row of data.twilio) {
    waByDate.set(row.date, (waByDate.get(row.date) ?? 0) + (row.total_sent ?? 0));
  }
  const waChart = Array.from(waByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date: date.slice(5), mensajes: total }));

  return (
    <KpiLayout
      title="KPIs"
      subtitle="Resumen ejecutivo — datos reales de Kalyo, Meta, GA4 y Twilio"
    >
      {Object.keys(data.errors).length > 0 ? (
        <div className="space-y-2">
          {Object.entries(data.errors).map(([key, msg]) => (
            <KpiSectionError key={key} title={`Error: ${key}`} error={msg} />
          ))}
        </div>
      ) : null}

      <RealtimeWidget />

      {!hasAnyData ? (
        <KpiEmptyState />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiMetricCard label="MRR" value={fmtUsd(data.kalyo?.mrr)} />
            <KpiMetricCard label="Trials" value={fmtNum(data.kalyo?.trialing)} />
            <KpiMetricCard label="IG Reach 7d" value={fmtNum(data.igReach7d)} />
            <KpiMetricCard label="Meta Spend hoy" value={fmtUsd(data.metaSpendToday)} />
            <KpiMetricCard label="Sesiones Landing" value={fmtNum(data.landingSessions30d)} />
            <KpiMetricCard label="WA Enviados" value={fmtNum(waTotal || null)} hint="30 días" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-lg border border-bg-border bg-bg p-5 lg:col-span-1">
              <h2 className="text-sm font-semibold text-fg">MRR histórico</h2>
              <div className="mt-4">
                {mrrChart.length > 0 ? (
                  <KpiLineChart
                    data={mrrChart}
                    xKey="date"
                    series={[{ dataKey: 'mrr', name: 'MRR USD', color: '#10B981' }]}
                  />
                ) : (
                  <KpiEmptyState description="Ejecuta /api/cron/kalyo-sync para poblar datos" />
                )}
              </div>
            </section>

            <section className="rounded-lg border border-bg-border bg-bg p-5 lg:col-span-1">
              <h2 className="text-sm font-semibold text-fg">Reach IG diario</h2>
              <div className="mt-4">
                {igChart.length > 0 ? (
                  <KpiLineChart
                    data={igChart}
                    xKey="date"
                    series={[{ dataKey: 'reach', name: 'Reach', color: '#6366F1' }]}
                  />
                ) : (
                  <KpiEmptyState description="Requiere META_ACCESS_TOKEN válido" />
                )}
              </div>
            </section>

            <section className="rounded-lg border border-bg-border bg-bg p-5 lg:col-span-1">
              <h2 className="text-sm font-semibold text-fg">Mensajes WA por día</h2>
              <div className="mt-4">
                {waChart.length > 0 ? (
                  <KpiLineChart
                    data={waChart}
                    xKey="date"
                    series={[{ dataKey: 'mensajes', name: 'Enviados', color: '#10B981' }]}
                  />
                ) : (
                  <KpiEmptyState description="Ejecuta /api/cron/twilio-sync para poblar datos" />
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </KpiLayout>
  );
}
