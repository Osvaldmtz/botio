'use client';

import { useMemo } from 'react';
import { DollarSign, FlaskConical, Layers, TrendingDown, TrendingUp, Users } from 'lucide-react';
import type { KalyoMetricRow } from '@/lib/kpi/types';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiVividMetric } from '@/components/admin/kpis/vivid/kpi-vivid-metric';
import { KpiVividPanel } from '@/components/admin/kpis/vivid/kpi-vivid-panel';
import { KpiVividAreaChart, KpiVividLineChart, KpiVividPieChart } from '@/components/admin/kpis/vivid/kpi-vivid-charts';
import { KpiVividTable } from '@/components/admin/kpis/vivid/kpi-vivid-table';
import { KpiVividPage, sliceByRange } from '@/components/admin/kpis/vivid/kpi-page-shell';

type Props = { latest: KalyoMetricRow | null; history: KalyoMetricRow[] };

export function RevenueKpiDashboard({ latest, history }: Props) {
  return (
    <KpiVividPage
      title="Revenue KPIs"
      subtitle="MRR, suscriptores y mix de planes"
      sources={[{ id: 'kalyo', label: 'Kalyo', ok: latest != null || history.length > 0 }]}
    >
      {({ range }) => <RevenueContent latest={latest} history={history} range={range} />}
    </KpiVividPage>
  );
}

function RevenueContent({
  latest,
  history,
  range,
}: {
  latest: KalyoMetricRow | null;
  history: KalyoMetricRow[];
  range: 7 | 14 | 30;
}) {
  const pro = latest?.plan_pro ?? 0;
  const max = latest?.plan_max ?? 0;
  const total = pro + max;
  const proPct = total > 0 ? ((pro / total) * 100).toFixed(1) : '0';
  const maxPct = total > 0 ? ((max / total) * 100).toFixed(1) : '0';
  const mrr = Number(latest?.mrr ?? 0);
  const subs = latest?.active_subscribers ?? 0;
  const arpu = subs > 0 ? mrr / subs : null;

  const filtered = useMemo(() => sliceByRange(history, range), [history, range]);
  const mrrChart = filtered.map((row) => ({
    date: row.date.slice(5),
    mrr: Number(row.mrr ?? 0),
    subs: Number(row.active_subscribers ?? 0),
    trials: Number(row.trialing ?? 0),
    churn: Number(row.churned_today ?? 0),
    converted: Number(row.converted_today ?? 0),
  }));

  const planPie = total > 0 ? [{ name: 'Pro', value: pro }, { name: 'Max', value: max }] : [];

  const planRows = [
    { plan: 'Pro (starter)', count: pro, pct: `${proPct}%`, revenue: pro * 29 },
    { plan: 'Max (professional)', count: max, pct: `${maxPct}%`, revenue: max * 39 },
  ];

  if (!latest && history.length === 0) {
    return <KpiEmptyState description="Ejecuta /api/cron/kalyo-sync" />;
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiVividMetric label="MRR" value={latest?.mrr != null ? `$${Number(latest.mrr).toLocaleString()}` : '—'} icon={DollarSign} accent="emerald" spark={mrrChart.map((d) => d.mrr)} />
        <KpiVividMetric label="Suscriptores" value={(latest?.active_subscribers ?? 0).toLocaleString()} icon={Users} accent="sky" />
        <KpiVividMetric label="Trialing" value={(latest?.trialing ?? 0).toLocaleString()} icon={FlaskConical} accent="violet" />
        <KpiVividMetric label="Pro / Max" value={`${pro} / ${max}`} icon={Layers} accent="indigo" />
        <KpiVividMetric label="ARPU" value={arpu != null ? `$${arpu.toFixed(0)}` : '—'} icon={TrendingUp} accent="amber" />
        <KpiVividMetric label="Churn hoy" value={String(latest?.churned_today ?? 0)} icon={TrendingDown} accent="rose" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <KpiVividPanel title="MRR histórico" subtitle={`${range}d`} accent="emerald">
          {mrrChart.length > 0 ? (
            <KpiVividAreaChart
              data={mrrChart}
              xKey="date"
              series={[
                { dataKey: 'mrr', name: 'MRR USD', color: '#10B981' },
                { dataKey: 'subs', name: 'Suscriptores', color: '#0EA5E9' },
              ]}
              height={260}
            />
          ) : (
            <KpiEmptyState />
          )}
        </KpiVividPanel>
        <KpiVividPanel title="Trials + conversiones" accent="violet">
          {mrrChart.length > 0 ? (
            <KpiVividAreaChart
              data={mrrChart}
              xKey="date"
              series={[
                { dataKey: 'trials', name: 'Trials', color: '#8B5CF6' },
                { dataKey: 'converted', name: 'Convertidos hoy', color: '#10B981' },
                { dataKey: 'churn', name: 'Churn hoy', color: '#F43F5E' },
              ]}
              height={260}
            />
          ) : (
            <KpiEmptyState />
          )}
        </KpiVividPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <KpiVividPanel title="Mix de planes" accent="indigo">
          {planPie.length > 0 ? <KpiVividPieChart data={planPie} height={220} /> : <KpiEmptyState />}
        </KpiVividPanel>
        <KpiVividPanel title="Suscriptores (línea)" accent="sky">
          {mrrChart.length > 0 ? (
            <KpiVividLineChart
              data={mrrChart}
              xKey="date"
              series={[{ dataKey: 'subs', name: 'Suscriptores', color: '#0EA5E9' }]}
              height={220}
            />
          ) : (
            <KpiEmptyState />
          )}
        </KpiVividPanel>
      </div>

      <KpiVividPanel title="Por plan" accent="amber">
        <KpiVividTable
          rows={planRows}
          rowKey={(r) => r.plan}
          columns={[
            { key: 'plan', header: 'Plan', render: (r) => r.plan },
            { key: 'count', header: 'Count', render: (r) => <span className="tabular-nums">{r.count}</span> },
            { key: 'pct', header: '% total', render: (r) => <span className="tabular-nums">{r.pct}</span> },
            { key: 'rev', header: 'Revenue/mo', render: (r) => <span className="tabular-nums text-emerald-600">${r.revenue.toLocaleString()}</span> },
          ]}
        />
      </KpiVividPanel>
    </>
  );
}
