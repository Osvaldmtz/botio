'use client';

import type { TwilioMetricRow } from '@/lib/kpi/types';
import { aggregateTwilio } from '@/lib/kpi/utils';
import { KpiLayout } from '@/components/admin/kpis/kpi-layout';
import { KpiMetricCard } from '@/components/admin/kpis/kpi-metric-card';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiBarChart } from '@/components/admin/kpis/kpi-charts';

type Props = {
  rows: TwilioMetricRow[];
};

export function WhatsappKpiDashboard({ rows }: Props) {
  const totals = aggregateTwilio(rows);
  const deliveryRate =
    totals.total_sent > 0 ? ((totals.delivered / totals.total_sent) * 100).toFixed(1) : '—';

  const labels = Array.from(new Set(rows.map((r) => r.phone_label ?? r.phone_number)));
  const dates = Array.from(new Set(rows.map((r) => r.date))).sort();
  const chartData = dates.map((date) => {
    const point: Record<string, string | number> = { date: date.slice(5) };
    for (const label of labels) {
      const match = rows.find((r) => r.date === date && (r.phone_label ?? r.phone_number) === label);
      point[label] = match?.total_sent ?? 0;
    }
    return point;
  });

  const byPhone = labels.map((label) => {
    const phoneRows = rows.filter((r) => (r.phone_label ?? r.phone_number) === label);
    const agg = aggregateTwilio(phoneRows);
    const rate =
      agg.total_sent > 0 ? ((agg.delivered / agg.total_sent) * 100).toFixed(1) : '0.0';
    return {
      label,
      ...agg,
      delivery_rate: rate,
    };
  });

  return (
    <KpiLayout title="WhatsApp KPIs" subtitle="Métricas Twilio — últimos 30 días">
      {rows.length === 0 ? (
        <KpiEmptyState description="Ejecuta /api/cron/twilio-sync para sincronizar mensajes" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiMetricCard label="Total enviados" value={totals.total_sent.toLocaleString()} />
            <KpiMetricCard label="Tasa entrega" value={`${deliveryRate}%`} />
            <KpiMetricCard label="Fallidos" value={totals.failed.toLocaleString()} />
            <KpiMetricCard
              label="Costo total USD"
              value={`$${totals.total_cost_usd.toFixed(2)}`}
            />
          </div>

          <section className="rounded-lg border border-bg-border bg-bg p-5">
            <h2 className="text-sm font-semibold text-fg">Mensajes por día</h2>
            <div className="mt-4">
              <KpiBarChart
                data={chartData}
                xKey="date"
                stacked
                bars={labels.map((label, i) => ({
                  dataKey: label,
                  name: label,
                  color: i === 0 ? '#10B981' : '#6366F1',
                }))}
              />
            </div>
          </section>

          <section className="rounded-lg border border-bg-border bg-bg p-5">
            <h2 className="text-sm font-semibold text-fg">Por número</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-bg-border text-fg-tertiary">
                    <th className="pb-2 pr-4 font-medium">Número</th>
                    <th className="pb-2 pr-4 font-medium">Enviados</th>
                    <th className="pb-2 pr-4 font-medium">Entregados</th>
                    <th className="pb-2 pr-4 font-medium">Fallidos</th>
                    <th className="pb-2 pr-4 font-medium">Entrega %</th>
                    <th className="pb-2 font-medium">Costo USD</th>
                  </tr>
                </thead>
                <tbody>
                  {byPhone.map((row) => (
                    <tr key={row.label} className="border-b border-bg-border/60">
                      <td className="py-2 pr-4 text-fg">{row.label}</td>
                      <td className="py-2 pr-4 tabular-nums">{row.total_sent}</td>
                      <td className="py-2 pr-4 tabular-nums">{row.delivered}</td>
                      <td className="py-2 pr-4 tabular-nums">{row.failed}</td>
                      <td className="py-2 pr-4 tabular-nums">{row.delivery_rate}%</td>
                      <td className="py-2 tabular-nums">${row.total_cost_usd.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </KpiLayout>
  );
}
