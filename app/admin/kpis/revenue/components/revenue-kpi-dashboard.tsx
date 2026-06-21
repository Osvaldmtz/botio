'use client';

import type { KalyoMetricRow } from '@/lib/kpi/types';
import { KpiLayout } from '@/components/admin/kpis/kpi-layout';
import { KpiMetricCard } from '@/components/admin/kpis/kpi-metric-card';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiLineChart } from '@/components/admin/kpis/kpi-charts';

type Props = {
  latest: KalyoMetricRow | null;
  history: KalyoMetricRow[];
};

export function RevenueKpiDashboard({ latest, history }: Props) {
  const pro = latest?.plan_pro ?? 0;
  const max = latest?.plan_max ?? 0;
  const total = pro + max;
  const proPct = total > 0 ? ((pro / total) * 100).toFixed(1) : '0';
  const maxPct = total > 0 ? ((max / total) * 100).toFixed(1) : '0';

  const mrrChart = history.map((row) => ({
    date: row.date.slice(5),
    mrr: Number(row.mrr ?? 0),
  }));

  const planRows = [
    {
      plan: 'Pro (starter)',
      count: pro,
      pct: `${proPct}%`,
      revenue: pro * 29,
    },
    {
      plan: 'Max (professional)',
      count: max,
      pct: `${maxPct}%`,
      revenue: max * 39,
    },
  ];

  return (
    <KpiLayout title="Revenue KPIs" subtitle="MRR y suscriptores activos desde Kalyo Supabase">
      {!latest && history.length === 0 ? (
        <KpiEmptyState description="Ejecuta /api/cron/kalyo-sync para sincronizar MRR" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiMetricCard
              label="MRR"
              value={latest?.mrr != null ? `$${Number(latest.mrr).toLocaleString()}` : '—'}
            />
            <KpiMetricCard
              label="Active subscribers"
              value={(latest?.active_subscribers ?? 0).toLocaleString()}
            />
            <KpiMetricCard label="Trialing" value={(latest?.trialing ?? 0).toLocaleString()} />
            <KpiMetricCard label="Ratio Pro/Max" value={`${pro} / ${max}`} />
          </div>

          <section className="rounded-lg border border-bg-border bg-bg p-5">
            <h2 className="text-sm font-semibold text-fg">MRR (90 días)</h2>
            <div className="mt-4">
              {mrrChart.length > 0 ? (
                <KpiLineChart
                  data={mrrChart}
                  xKey="date"
                  series={[{ dataKey: 'mrr', name: 'MRR USD', color: '#10B981' }]}
                  height={280}
                />
              ) : (
                <KpiEmptyState />
              )}
            </div>
          </section>

          <section className="rounded-lg border border-bg-border bg-bg p-5">
            <h2 className="text-sm font-semibold text-fg">Por plan</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-bg-border text-fg-tertiary">
                    <th className="pb-2 pr-4 font-medium">Plan</th>
                    <th className="pb-2 pr-4 font-medium">Count</th>
                    <th className="pb-2 pr-4 font-medium">% total</th>
                    <th className="pb-2 font-medium">Revenue/mo</th>
                  </tr>
                </thead>
                <tbody>
                  {planRows.map((row) => (
                    <tr key={row.plan} className="border-b border-bg-border/60">
                      <td className="py-2 pr-4 text-fg">{row.plan}</td>
                      <td className="py-2 pr-4 tabular-nums">{row.count}</td>
                      <td className="py-2 pr-4 tabular-nums">{row.pct}</td>
                      <td className="py-2 tabular-nums">${row.revenue.toLocaleString()}</td>
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
