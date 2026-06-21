'use client';

import { useMemo } from 'react';
import { DollarSign, MessageCircle, Send, XCircle } from 'lucide-react';
import type { TwilioMetricRow } from '@/lib/kpi/types';
import { aggregateTwilio } from '@/lib/kpi/utils';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiHudMetric } from '@/components/admin/kpis/jarvis/kpi-hud-metric';
import { KpiJarvisPanel } from '@/components/admin/kpis/jarvis/kpi-jarvis-theme';
import { KpiJarvisBarChart } from '@/components/admin/kpis/jarvis/kpi-bar-chart';
import { KpiJarvisTable } from '@/components/admin/kpis/jarvis/kpi-jarvis-table';
import { KpiJarvisPage, sliceByRange } from '@/components/admin/kpis/jarvis/kpi-page-shell';

type Props = {
  rows: TwilioMetricRow[];
};

export function WhatsappKpiDashboard({ rows }: Props) {
  return (
    <KpiJarvisPage
      title="WhatsApp KPIs"
      subtitle="Throughput Twilio — mensajes, entrega y costos"
      sources={[{ id: 'twilio', label: 'Twilio', ok: rows.length > 0 }]}
    >
      {({ range }) => (
        <WhatsappContent rows={rows} range={range} />
      )}
    </KpiJarvisPage>
  );
}

function WhatsappContent({
  rows,
  range,
}: {
  rows: TwilioMetricRow[];
  range: 7 | 14 | 30;
}) {
  const filtered = useMemo(() => sliceByRange(rows, range), [rows, range]);
  const totals = aggregateTwilio(filtered);
  const deliveryRate =
    totals.total_sent > 0 ? ((totals.delivered / totals.total_sent) * 100).toFixed(1) : '—';

  const labels = Array.from(new Set(filtered.map((r) => r.phone_label ?? r.phone_number)));
  const dates = Array.from(new Set(filtered.map((r) => r.date))).sort();
  const chartData = dates.map((date) => {
    const point: Record<string, string | number> = { date: date.slice(5) };
    for (const label of labels) {
      const match = filtered.find(
        (r) => r.date === date && (r.phone_label ?? r.phone_number) === label,
      );
      point[label] = match?.total_sent ?? 0;
    }
    return point;
  });

  const waSpark = chartData.map((d) =>
    labels.reduce((sum, l) => sum + Number(d[l] ?? 0), 0),
  );

  const byPhone = labels.map((label) => {
    const phoneRows = filtered.filter((r) => (r.phone_label ?? r.phone_number) === label);
    const agg = aggregateTwilio(phoneRows);
    const rate =
      agg.total_sent > 0 ? ((agg.delivered / agg.total_sent) * 100).toFixed(1) : '0.0';
    return { label, ...agg, delivery_rate: rate };
  });

  if (rows.length === 0) {
    return <KpiEmptyState variant="jarvis" description="Ejecuta /api/cron/twilio-sync" />;
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiHudMetric
          label="Total enviados"
          value={totals.total_sent.toLocaleString()}
          icon={Send}
          accent="rose"
          spark={waSpark}
        />
        <KpiHudMetric
          label="Tasa entrega"
          value={`${deliveryRate}%`}
          icon={MessageCircle}
          accent="emerald"
        />
        <KpiHudMetric
          label="Fallidos"
          value={totals.failed.toLocaleString()}
          icon={XCircle}
          accent="amber"
        />
        <KpiHudMetric
          label="Costo USD"
          value={`$${totals.total_cost_usd.toFixed(2)}`}
          icon={DollarSign}
          accent="cyan"
        />
      </div>

      <KpiJarvisPanel
        title="Daily Throughput"
        subtitle={`Mensajes por día · ${range}d`}
        accent="rose"
      >
        {chartData.length > 0 ? (
          <KpiJarvisBarChart
            data={chartData}
            xKey="date"
            stacked
            bars={labels.map((label, i) => ({
              dataKey: label,
              name: label,
              color: i === 0 ? '#fb7185' : '#a78bfa',
            }))}
            height={260}
          />
        ) : (
          <KpiEmptyState variant="jarvis" />
        )}
      </KpiJarvisPanel>

      <KpiJarvisPanel title="Phone Matrix" subtitle="Desglose por número" accent="violet">
        <KpiJarvisTable
          rows={byPhone}
          rowKey={(r) => r.label}
          columns={[
            { key: 'label', header: 'Número', render: (r) => r.label },
            {
              key: 'sent',
              header: 'Enviados',
              render: (r) => <span className="tabular-nums">{r.total_sent}</span>,
            },
            {
              key: 'delivered',
              header: 'Entregados',
              render: (r) => <span className="tabular-nums">{r.delivered}</span>,
            },
            {
              key: 'failed',
              header: 'Fallidos',
              render: (r) => <span className="tabular-nums">{r.failed}</span>,
            },
            {
              key: 'rate',
              header: 'Entrega %',
              render: (r) => <span className="tabular-nums text-emerald-300">{r.delivery_rate}%</span>,
            },
            {
              key: 'cost',
              header: 'Costo USD',
              render: (r) => (
                <span className="tabular-nums">${r.total_cost_usd.toFixed(2)}</span>
              ),
            },
          ]}
        />
      </KpiJarvisPanel>
    </>
  );
}
