'use client';

import { useMemo } from 'react';
import { DollarSign, FlaskConical, Layers, Users } from 'lucide-react';
import type { KalyoMetricRow } from '@/lib/kpi/types';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiHudMetric } from '@/components/admin/kpis/jarvis/kpi-hud-metric';
import { KpiJarvisPanel } from '@/components/admin/kpis/jarvis/kpi-jarvis-theme';
import { KpiJarvisAreaChart } from '@/components/admin/kpis/jarvis/kpi-area-chart';
import { KpiJarvisTable } from '@/components/admin/kpis/jarvis/kpi-jarvis-table';
import { KpiJarvisPage, sliceByRange } from '@/components/admin/kpis/jarvis/kpi-page-shell';

type Props = {
  latest: KalyoMetricRow | null;
  history: KalyoMetricRow[];
};

export function RevenueKpiDashboard({ latest, history }: Props) {
  return (
    <KpiJarvisPage
      title="Revenue KPIs"
      subtitle="MRR y suscriptores — Kalyo Supabase"
      sources={[{ id: 'kalyo', label: 'Kalyo', ok: latest != null || history.length > 0 }]}
    >
      {({ range }) => <RevenueContent latest={latest} history={history} range={range} />}
    </KpiJarvisPage>
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

  const filtered = useMemo(() => sliceByRange(history, range), [history, range]);
  const mrrChart = filtered.map((row) => ({
    date: row.date.slice(5),
    mrr: Number(row.mrr ?? 0),
    subs: Number(row.active_subscribers ?? 0),
  }));

  const planRows = [
    { plan: 'Pro (starter)', count: pro, pct: `${proPct}%`, revenue: pro * 29 },
    { plan: 'Max (professional)', count: max, pct: `${maxPct}%`, revenue: max * 39 },
  ];

  if (!latest && history.length === 0) {
    return <KpiEmptyState variant="jarvis" description="Ejecuta /api/cron/kalyo-sync" />;
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiHudMetric
          label="MRR"
          value={latest?.mrr != null ? `$${Number(latest.mrr).toLocaleString()}` : '—'}
          icon={DollarSign}
          accent="emerald"
          spark={mrrChart.map((d) => d.mrr)}
        />
        <KpiHudMetric
          label="Active subscribers"
          value={(latest?.active_subscribers ?? 0).toLocaleString()}
          icon={Users}
          accent="cyan"
        />
        <KpiHudMetric
          label="Trialing"
          value={(latest?.trialing ?? 0).toLocaleString()}
          icon={FlaskConical}
          accent="violet"
        />
        <KpiHudMetric label="Ratio Pro/Max" value={`${pro} / ${max}`} icon={Layers} accent="amber" />
      </div>

      <KpiJarvisPanel title="MRR Stream" subtitle={`Histórico · ${range}d`} accent="emerald">
        {mrrChart.length > 0 ? (
          <KpiJarvisAreaChart
            data={mrrChart}
            xKey="date"
            series={[
              { dataKey: 'mrr', name: 'MRR USD', color: '#34d399' },
              { dataKey: 'subs', name: 'Suscriptores', color: '#22d3ee' },
            ]}
            height={280}
          />
        ) : (
          <KpiEmptyState variant="jarvis" />
        )}
      </KpiJarvisPanel>

      <KpiJarvisPanel title="Plan Breakdown" subtitle="Distribución por tier" accent="violet">
        <KpiJarvisTable
          rows={planRows}
          rowKey={(r) => r.plan}
          columns={[
            { key: 'plan', header: 'Plan', render: (r) => r.plan },
            {
              key: 'count',
              header: 'Count',
              render: (r) => <span className="tabular-nums">{r.count}</span>,
            },
            {
              key: 'pct',
              header: '% total',
              render: (r) => <span className="tabular-nums text-violet-300">{r.pct}</span>,
            },
            {
              key: 'revenue',
              header: 'Revenue/mo',
              render: (r) => (
                <span className="tabular-nums text-emerald-300">${r.revenue.toLocaleString()}</span>
              ),
            },
          ]}
        />
      </KpiJarvisPanel>
    </>
  );
}
