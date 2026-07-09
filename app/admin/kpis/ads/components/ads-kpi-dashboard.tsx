'use client';

import { useMemo } from 'react';
import { DollarSign, Eye, Megaphone, MousePointerClick, Percent, Target } from 'lucide-react';
import type { AdsPageData } from '@/lib/kpi/utils';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiVividMetric } from '@/components/admin/kpis/vivid/kpi-vivid-metric';
import { KpiVividPanel } from '@/components/admin/kpis/vivid/kpi-vivid-panel';
import { KpiVividAreaChart, KpiVividBarChart } from '@/components/admin/kpis/vivid/kpi-vivid-charts';
import { KpiVividTable } from '@/components/admin/kpis/vivid/kpi-vivid-table';
import { KpiVividPage } from '@/components/admin/kpis/vivid/kpi-page-shell';
import type { ChartRange } from '@/components/admin/kpis/vivid/kpi-toolbar';

type Props = { data: AdsPageData };

function sumField(rows: AdsPageData['summary'], field: keyof AdsPageData['summary'][number]): number {
  return rows.reduce((acc, row) => acc + Number(row[field] || 0), 0);
}

export function AdsKpiDashboard({ data }: Props) {
  return (
    <KpiVividPage
      title="Meta Ads KPIs"
      subtitle="Spend (MXN), impresiones, clicks y CTR"
      sources={[{ id: 'meta', label: 'Meta Ads', ok: !data.error && data.summary.length > 0 }]}
    >
      {({ range }) => (
        <>
          {data.error ? <KpiSectionError title="Meta Ads API" error={data.error} /> : null}
          <AdsContent data={data} range={range} />
        </>
      )}
    </KpiVividPage>
  );
}

function AdsContent({ data, range }: { data: AdsPageData; range: ChartRange }) {
  const spend = sumField(data.summary, 'spend');
  const impressions = sumField(data.summary, 'impressions');
  const clicks = sumField(data.summary, 'clicks');
  const reach = sumField(data.summary, 'reach');
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '—';
  const cpm = impressions > 0 ? ((spend / impressions) * 1000).toFixed(2) : '—';
  const cpc = clicks > 0 ? (spend / clicks).toFixed(2) : '—';

  const daily = useMemo(() => data.daily.slice(-range), [data.daily, range]);
  const chartData = daily.map((row) => ({
    date: (row.date_start ?? row.date_stop ?? '').slice(5),
    spend: Number(row.spend || 0),
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
  }));

  if (data.summary.length === 0) {
    return <KpiEmptyState description="Verifica META_ACCESS_TOKEN" />;
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-7">
        <KpiVividMetric label="Spend 30d" value={`$${spend.toFixed(2)} MXN`} icon={DollarSign} accent="amber" spark={chartData.map((d) => d.spend)} />
        <KpiVividMetric label="Impressions" value={impressions.toLocaleString()} icon={Eye} accent="violet" />
        <KpiVividMetric label="Clicks" value={clicks.toLocaleString()} icon={MousePointerClick} accent="sky" />
        <KpiVividMetric label="Reach" value={reach.toLocaleString()} icon={Megaphone} accent="fuchsia" />
        <KpiVividMetric label="CTR" value={`${ctr}%`} icon={Percent} accent="emerald" />
        <KpiVividMetric label="CPM" value={`$${cpm} MXN`} icon={Megaphone} accent="orange" />
        <KpiVividMetric label="CPC" value={`$${cpc} MXN`} icon={Target} accent="indigo" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <KpiVividPanel title="Spend diario" subtitle={`${range}d`} accent="amber">
          <KpiVividAreaChart data={chartData} xKey="date" series={[{ dataKey: 'spend', name: 'Spend MXN', color: '#F59E0B' }]} height={240} />
        </KpiVividPanel>
        <KpiVividPanel title="Impressions + Clicks" accent="violet">
          <KpiVividBarChart
            data={chartData}
            xKey="date"
            bars={[
              { dataKey: 'impressions', name: 'Impressions', color: '#8B5CF6' },
              { dataKey: 'clicks', name: 'Clicks', color: '#10B981' },
            ]}
            height={240}
          />
        </KpiVividPanel>
      </div>

      <KpiVividPanel title="Resumen cuenta" accent="sky">
        <KpiVividTable
          rows={data.summary.map((row, i) => ({ ...row, _id: String(i) }))}
          rowKey={(row) => row._id}
          columns={[
            { key: 'p', header: 'Periodo', render: (r) => `${r.date_start ?? '—'} → ${r.date_stop ?? '—'}` },
            { key: 's', header: 'Spend (MXN)', render: (r) => <span className="tabular-nums text-amber-600">${Number(r.spend || 0).toFixed(2)} MXN</span> },
            { key: 'i', header: 'Impressions', render: (r) => <span className="tabular-nums">{Number(r.impressions || 0).toLocaleString()}</span> },
            { key: 'c', header: 'Clicks', render: (r) => <span className="tabular-nums">{Number(r.clicks || 0).toLocaleString()}</span> },
            { key: 'ctr', header: 'CTR', render: (r) => <span className="tabular-nums">{Number(r.ctr || 0).toFixed(2)}%</span> },
          ]}
        />
      </KpiVividPanel>
    </>
  );
}
