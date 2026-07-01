'use client';

import { useMemo } from 'react';
import {
  Clock,
  DollarSign,
  FlaskConical,
  Layers,
  Scale,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { KalyoMetricRow } from '@/lib/kpi/types';
import {
  computeLtvDerived,
  formatLtvCacRatio,
  formatLtvMonthsLabel,
  getLtvCacRatioCardHealth,
} from '@/lib/kpi/ltv-utils';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiVividMetric } from '@/components/admin/kpis/vivid/kpi-vivid-metric';
import { KpiVividPanel } from '@/components/admin/kpis/vivid/kpi-vivid-panel';
import { KpiVividAreaChart, KpiVividLineChart, KpiVividPieChart } from '@/components/admin/kpis/vivid/kpi-vivid-charts';
import { KpiVividTable } from '@/components/admin/kpis/vivid/kpi-vivid-table';
import { KpiVividPage, sliceByRange } from '@/components/admin/kpis/vivid/kpi-page-shell';
import { ACTIVE_SUBSCRIBER_GOAL } from '@/lib/kpi/utils';

type Props = {
  latest: KalyoMetricRow | null;
  history: KalyoMetricRow[];
  stripeActiveSubscribers: number | null;
  stripeMrr: number | null;
};

export function RevenueKpiDashboard({ latest, history, stripeActiveSubscribers, stripeMrr }: Props) {
  return (
    <KpiVividPage
      title="Revenue KPIs"
      subtitle="MRR, churn, LTV y mix de planes"
      sources={[
        { id: 'kalyo', label: 'Kalyo', ok: latest != null || history.length > 0 },
        { id: 'stripe', label: 'Stripe', ok: stripeActiveSubscribers != null || stripeMrr != null },
      ]}
    >
      {({ range }) => (
        <RevenueContent
          latest={latest}
          history={history}
          range={range}
          stripeActiveSubscribers={stripeActiveSubscribers}
          stripeMrr={stripeMrr}
        />
      )}
    </KpiVividPage>
  );
}

function RevenueContent({
  latest,
  history,
  range,
  stripeActiveSubscribers,
  stripeMrr,
}: {
  latest: KalyoMetricRow | null;
  history: KalyoMetricRow[];
  range: 7 | 14 | 30;
  stripeActiveSubscribers: number | null;
  stripeMrr: number | null;
}) {
  const pro = latest?.plan_pro ?? 0;
  const max = latest?.plan_max ?? 0;
  const total = pro + max;
  const proPct = total > 0 ? ((pro / total) * 100).toFixed(1) : '0';
  const maxPct = total > 0 ? ((max / total) * 100).toFixed(1) : '0';
  const kalyoMrr = Number(latest?.mrr ?? 0);
  const activeSubs = stripeActiveSubscribers ?? 0;
  const kalyoSubs = latest?.active_subscribers ?? 0;
  const churned30d = latest?.churned_30d ?? 0;
  const churnRate = Number(latest?.churn_rate ?? 0);

  const storedCacUsd =
    latest?.cac_usd != null ? Number(latest.cac_usd) : null;
  const storedCacAlltime =
    latest?.cac_usd_alltime != null ? Number(latest.cac_usd_alltime) : null;

  const ltv = useMemo(
    () =>
      computeLtvDerived({
        mrr: kalyoMrr,
        active_subscribers: kalyoSubs,
        churn_rate: churnRate,
        cac_usd: storedCacUsd,
      }),
    [kalyoMrr, kalyoSubs, churnRate, storedCacUsd],
  );

  const storedLtvAvg = latest?.ltv_avg != null ? Number(latest.ltv_avg) : ltv.ltv_avg;
  const storedRatio =
    latest?.ltv_cac_ratio != null ? Number(latest.ltv_cac_ratio) : ltv.ltv_cac_ratio;
  const storedRatioAlltime =
    latest?.ltv_cac_ratio_alltime != null ? Number(latest.ltv_cac_ratio_alltime) : null;
  const ratioHealth = getLtvCacRatioCardHealth(storedRatio);
  const newSubs30d = latest?.new_subscribers_30d ?? null;

  const filtered = useMemo(() => sliceByRange(history, range), [history, range]);
  const mrrChart = filtered.map((row) => ({
    date: row.date.slice(5),
    mrr: Number(row.mrr ?? 0),
    subs: Number(row.active_subscribers ?? 0),
    trials: Number(row.trialing ?? 0),
    churn: Number(row.churned_today ?? 0),
    converted: Number(row.converted_today ?? 0),
    churn30d: Number(row.churned_30d ?? 0),
    churnRate: Number(row.churn_rate ?? 0),
  }));

  const planPie = total > 0 ? [{ name: 'Pro', value: pro }, { name: 'Max', value: max }] : [];

  const planRows = [
    { plan: 'Pro (starter)', count: pro, pct: `${proPct}%`, revenue: pro * 29 },
    { plan: 'Max (professional)', count: max, pct: `${maxPct}%`, revenue: max * 39 },
  ];

  if (!latest && history.length === 0) {
    return <KpiEmptyState description="Ejecuta /api/cron/kalyo-sync" />;
  }

  const churn30dLabel =
    churned30d === 0
      ? 'Sin cancelaciones'
      : `${churned30d} cancelación${churned30d === 1 ? '' : 'es'}`;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiVividMetric
          label="MRR"
          value={stripeMrr != null ? `$${stripeMrr.toLocaleString()}` : '—'}
          icon={DollarSign}
          accent="emerald"
          spark={mrrChart.map((d) => d.mrr)}
        />
        <KpiVividMetric
          label="Suscriptores"
          value={stripeActiveSubscribers != null ? activeSubs.toLocaleString() : '—'}
          icon={Users}
          accent="sky"
          progress={
            stripeActiveSubscribers != null
              ? { current: activeSubs, goal: ACTIVE_SUBSCRIBER_GOAL }
              : undefined
          }
        />
        <KpiVividMetric label="Trialing" value={(latest?.trialing ?? 0).toLocaleString()} icon={FlaskConical} accent="violet" />
        <KpiVividMetric label="Pro / Max" value={`${pro} / ${max}`} icon={Layers} accent="indigo" />
        <KpiVividMetric label="ARPU" value={ltv.avg_mrr_per_subscriber > 0 ? `$${ltv.avg_mrr_per_subscriber.toFixed(0)}` : '—'} icon={TrendingUp} accent="amber" />
        <KpiVividMetric label="Churn hoy" value={String(latest?.churned_today ?? 0)} icon={TrendingDown} accent="rose" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <KpiVividMetric
          label="Churn 30d"
          value={churn30dLabel}
          icon={TrendingDown}
          accent={churned30d === 0 ? 'emerald' : 'rose'}
        />
        <KpiVividMetric
          label="Churn rate"
          value={`${churnRate.toFixed(1)}%`}
          hint="mensual"
          icon={TrendingDown}
          accent="orange"
        />
        <KpiVividMetric
          label="LTV promedio"
          value={`$${storedLtvAvg.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD`}
          hint={formatLtvMonthsLabel(churnRate)}
          icon={DollarSign}
          accent="violet"
        />
        <KpiVividMetric
          label="Ratio LTV:CAC (30d)"
          value={formatLtvCacRatio(storedRatio)}
          hint={ratioHealth.hint}
          icon={Scale}
          accent={ratioHealth.accent}
        />
        <KpiVividMetric
          label="Ratio LTV:CAC (all-time)"
          value={formatLtvCacRatio(storedRatioAlltime)}
          hint={
            storedRatioAlltime != null && storedRatioAlltime > 0
              ? 'Gasto total Meta / clientes de por vida'
              : 'Sin datos históricos'
          }
          icon={Scale}
          accent={
            storedRatioAlltime != null && storedRatioAlltime > 3
              ? 'emerald'
              : storedRatioAlltime != null && storedRatioAlltime >= 1
                ? 'amber'
                : 'rose'
          }
        />
        <KpiVividMetric
          label="Payback period"
          value={
            ltv.payback_months != null
              ? `${ltv.payback_months.toFixed(1)} meses`
              : '—'
          }
          hint={
            storedCacUsd != null
              ? `CAC 30d ~$${storedCacUsd.toFixed(0)} USD${newSubs30d != null && newSubs30d > 0 ? ` · ${newSubs30d} nuevos` : ''}`
              : storedCacAlltime != null
                ? `CAC hist. ~$${storedCacAlltime.toFixed(0)} USD`
                : 'Sin CAC calculado'
          }
          icon={Clock}
          accent="sky"
        />
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
        <KpiVividPanel title="Churn rate mensual" accent="rose">
          {mrrChart.length > 0 ? (
            <KpiVividLineChart
              data={mrrChart}
              xKey="date"
              series={[{ dataKey: 'churnRate', name: 'Churn rate %', color: '#F43F5E' }]}
              height={260}
            />
          ) : (
            <KpiEmptyState />
          )}
        </KpiVividPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
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
              height={220}
            />
          ) : (
            <KpiEmptyState />
          )}
        </KpiVividPanel>
        <KpiVividPanel title="Cancelaciones 30d" accent="amber">
          {mrrChart.length > 0 ? (
            <KpiVividLineChart
              data={mrrChart}
              xKey="date"
              series={[{ dataKey: 'churn30d', name: 'Churn 30d', color: '#F59E0B' }]}
              height={220}
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
        <KpiVividPanel title="LTV por plan" subtitle={formatLtvMonthsLabel(churnRate)} accent="sky">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiVividMetric label="LTV Pro" value={`$${ltv.ltv_pro.toFixed(0)}`} accent="indigo" compact />
            <KpiVividMetric label="LTV Max" value={`$${ltv.ltv_max.toFixed(0)}`} accent="violet" compact />
            <KpiVividMetric label="LTV avg" value={`$${storedLtvAvg.toFixed(0)}`} accent="emerald" compact />
          </div>
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
