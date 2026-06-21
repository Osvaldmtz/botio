'use client';

import { useMemo } from 'react';
import { DollarSign, MessageCircle, Send, XCircle } from 'lucide-react';
import type { TwilioMetricRow } from '@/lib/kpi/types';
import { aggregateTwilio } from '@/lib/kpi/utils';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiVividMetric } from '@/components/admin/kpis/vivid/kpi-vivid-metric';
import { KpiVividPanel } from '@/components/admin/kpis/vivid/kpi-vivid-panel';
import { KpiVividBarChart, KpiVividLineChart } from '@/components/admin/kpis/vivid/kpi-vivid-charts';
import { KpiVividTable } from '@/components/admin/kpis/vivid/kpi-vivid-table';
import { KpiVividPage, sliceByRange } from '@/components/admin/kpis/vivid/kpi-page-shell';

type Props = { rows: TwilioMetricRow[] };

export function WhatsappKpiDashboard({ rows }: Props) {
  return (
    <KpiVividPage
      title="WhatsApp KPIs"
      subtitle="Métricas Twilio — mensajes, entrega y costos"
      sources={[{ id: 'twilio', label: 'Twilio', ok: rows.length > 0 }]}
    >
      {({ range }) => <WhatsappContent rows={rows} range={range} />}
    </KpiVividPage>
  );
}

function WhatsappContent({ rows, range }: { rows: TwilioMetricRow[]; range: 7 | 14 | 30 }) {
  const filtered = useMemo(() => sliceByRange(rows, range), [rows, range]);
  const totals = aggregateTwilio(filtered);
  const deliveryRate =
    totals.total_sent > 0 ? ((totals.delivered / totals.total_sent) * 100).toFixed(1) : '—';

  const labels = Array.from(new Set(filtered.map((r) => r.phone_label ?? r.phone_number)));
  const dates = Array.from(new Set(filtered.map((r) => r.date))).sort();
  const chartData = dates.map((date) => {
    const point: Record<string, string | number> = { date: date.slice(5) };
    for (const label of labels) {
      const match = filtered.find((r) => r.date === date && (r.phone_label ?? r.phone_number) === label);
      point[label] = match?.total_sent ?? 0;
    }
    return point;
  });

  const rateChart = dates.map((date) => {
    const dayRows = filtered.filter((r) => r.date === date);
    const agg = aggregateTwilio(dayRows);
    return {
      date: date.slice(5),
      entrega: agg.total_sent > 0 ? Math.round((agg.delivered / agg.total_sent) * 1000) / 10 : 0,
      costo: Math.round(agg.total_cost_usd * 100) / 100,
    };
  });

  const byPhone = labels.map((label) => {
    const phoneRows = filtered.filter((r) => (r.phone_label ?? r.phone_number) === label);
    const agg = aggregateTwilio(phoneRows);
    const rate = agg.total_sent > 0 ? ((agg.delivered / agg.total_sent) * 100).toFixed(1) : '0.0';
    return { label, ...agg, delivery_rate: rate };
  });

  if (rows.length === 0) {
    return <KpiEmptyState description="Ejecuta /api/cron/twilio-sync" />;
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiVividMetric label="Enviados" value={totals.total_sent.toLocaleString()} icon={Send} accent="rose" />
        <KpiVividMetric label="Entrega %" value={`${deliveryRate}%`} icon={MessageCircle} accent="emerald" />
        <KpiVividMetric label="Fallidos" value={totals.failed.toLocaleString()} icon={XCircle} accent="orange" />
        <KpiVividMetric label="Costo USD" value={`$${totals.total_cost_usd.toFixed(2)}`} icon={DollarSign} accent="amber" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <KpiVividPanel title="Mensajes por día" subtitle={`Por número · ${range}d`} accent="rose">
          <KpiVividBarChart
            data={chartData}
            xKey="date"
            stacked
            bars={labels.map((label, i) => ({
              dataKey: label,
              name: label,
              color: ['#F43F5E', '#8B5CF6', '#0EA5E9', '#F59E0B'][i % 4],
            }))}
            height={260}
          />
        </KpiVividPanel>
        <KpiVividPanel title="Entrega % diaria" accent="emerald">
          <KpiVividLineChart
            data={rateChart}
            xKey="date"
            series={[{ dataKey: 'entrega', name: 'Entrega %', color: '#10B981' }]}
            height={260}
          />
        </KpiVividPanel>
      </div>

      <KpiVividPanel title="Por número" accent="violet">
        <KpiVividTable
          rows={byPhone}
          rowKey={(r) => r.label}
          columns={[
            { key: 'label', header: 'Número', render: (r) => r.label },
            { key: 'sent', header: 'Enviados', render: (r) => <span className="tabular-nums">{r.total_sent}</span> },
            { key: 'del', header: 'Entregados', render: (r) => <span className="tabular-nums">{r.delivered}</span> },
            { key: 'fail', header: 'Fallidos', render: (r) => <span className="tabular-nums">{r.failed}</span> },
            { key: 'rate', header: 'Entrega %', render: (r) => <span className="tabular-nums text-emerald-600">{r.delivery_rate}%</span> },
            { key: 'cost', header: 'Costo', render: (r) => <span className="tabular-nums">${r.total_cost_usd.toFixed(2)}</span> },
          ]}
        />
      </KpiVividPanel>
    </>
  );
}
