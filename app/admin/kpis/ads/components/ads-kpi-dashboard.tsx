'use client';

import type { AdsPageData } from '@/lib/kpi/utils';
import { KpiLayout } from '@/components/admin/kpis/kpi-layout';
import { KpiMetricCard } from '@/components/admin/kpis/kpi-metric-card';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiLineChart } from '@/components/admin/kpis/kpi-charts';

type Props = {
  data: AdsPageData;
};

function sumField(rows: AdsPageData['summary'], field: keyof AdsPageData['summary'][number]): number {
  return rows.reduce((acc, row) => acc + Number(row[field] || 0), 0);
}

export function AdsKpiDashboard({ data }: Props) {
  const spend = sumField(data.summary, 'spend');
  const impressions = sumField(data.summary, 'impressions');
  const clicks = sumField(data.summary, 'clicks');
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '—';
  const cpm = impressions > 0 ? ((spend / impressions) * 1000).toFixed(2) : '—';
  const cpc = clicks > 0 ? (spend / clicks).toFixed(2) : '—';

  const chartData = data.daily.map((row) => ({
    date: (row.date_start ?? row.date_stop ?? '').slice(5),
    spend: Number(row.spend || 0),
  }));

  return (
    <KpiLayout title="Meta Ads KPIs" subtitle="Spend, impresiones y CTR — cuenta act_1105914435027314">
      {data.error ? <KpiSectionError title="Meta Ads API" error={data.error} /> : null}

      {data.summary.length === 0 ? (
        <KpiEmptyState description="Verifica META_ACCESS_TOKEN y permisos ads_read" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiMetricCard label="Spend 30d" value={`$${spend.toFixed(2)}`} />
            <KpiMetricCard label="Impressions" value={impressions.toLocaleString()} />
            <KpiMetricCard label="Clicks" value={clicks.toLocaleString()} />
            <KpiMetricCard label="CTR" value={`${ctr}%`} />
            <KpiMetricCard label="CPM" value={`$${cpm}`} />
            <KpiMetricCard label="CPC" value={`$${cpc}`} />
          </div>

          <section className="rounded-lg border border-bg-border bg-bg p-5">
            <h2 className="text-sm font-semibold text-fg">Spend diario (30 días)</h2>
            <div className="mt-4">
              {chartData.length > 0 ? (
                <KpiLineChart
                  data={chartData}
                  xKey="date"
                  series={[{ dataKey: 'spend', name: 'Spend USD', color: '#10B981' }]}
                />
              ) : (
                <KpiEmptyState />
              )}
            </div>
          </section>

          <section className="rounded-lg border border-bg-border bg-bg p-5">
            <h2 className="text-sm font-semibold text-fg">Resumen cuenta</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-bg-border text-fg-tertiary">
                    <th className="pb-2 pr-4 font-medium">Periodo</th>
                    <th className="pb-2 pr-4 font-medium">Spend</th>
                    <th className="pb-2 pr-4 font-medium">Impressions</th>
                    <th className="pb-2 pr-4 font-medium">Clicks</th>
                    <th className="pb-2 font-medium">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.summary.map((row, i) => (
                    <tr key={i} className="border-b border-bg-border/60">
                      <td className="py-2 pr-4 text-fg">
                        {row.date_start ?? '—'} → {row.date_stop ?? '—'}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">${Number(row.spend || 0).toFixed(2)}</td>
                      <td className="py-2 pr-4 tabular-nums">{Number(row.impressions || 0).toLocaleString()}</td>
                      <td className="py-2 pr-4 tabular-nums">{Number(row.clicks || 0).toLocaleString()}</td>
                      <td className="py-2 tabular-nums">{Number(row.ctr || 0).toFixed(2)}%</td>
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
