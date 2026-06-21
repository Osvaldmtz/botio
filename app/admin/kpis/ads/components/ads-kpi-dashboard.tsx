'use client';

import { useMemo } from 'react';
import { DollarSign, Eye, Megaphone, MousePointerClick, Percent, Target } from 'lucide-react';
import type { AdsPageData } from '@/lib/kpi/utils';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiHudMetric } from '@/components/admin/kpis/jarvis/kpi-hud-metric';
import { KpiJarvisPanel } from '@/components/admin/kpis/jarvis/kpi-jarvis-theme';
import { KpiJarvisAreaChart } from '@/components/admin/kpis/jarvis/kpi-area-chart';
import { KpiJarvisTable } from '@/components/admin/kpis/jarvis/kpi-jarvis-table';
import { KpiJarvisPage } from '@/components/admin/kpis/jarvis/kpi-page-shell';

type Props = {
  data: AdsPageData;
};

function sumField(rows: AdsPageData['summary'], field: keyof AdsPageData['summary'][number]): number {
  return rows.reduce((acc, row) => acc + Number(row[field] || 0), 0);
}

export function AdsKpiDashboard({ data }: Props) {
  return (
    <KpiJarvisPage
      title="Meta Ads KPIs"
      subtitle="Paid media — act_1105914435027314"
      sources={[{ id: 'meta', label: 'Meta Ads', ok: !data.error && data.summary.length > 0 }]}
    >
      {({ range }) => (
        <>
          {data.error ? (
            <KpiSectionError title="Meta Ads API" error={data.error} variant="jarvis" />
          ) : null}
          <AdsContent data={data} range={range} />
        </>
      )}
    </KpiJarvisPage>
  );
}

function AdsContent({ data, range }: { data: AdsPageData; range: 7 | 14 | 30 }) {
  const spend = sumField(data.summary, 'spend');
  const impressions = sumField(data.summary, 'impressions');
  const clicks = sumField(data.summary, 'clicks');
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '—';
  const cpm = impressions > 0 ? ((spend / impressions) * 1000).toFixed(2) : '—';
  const cpc = clicks > 0 ? (spend / clicks).toFixed(2) : '—';

  const daily = useMemo(() => data.daily.slice(-range), [data.daily, range]);
  const chartData = daily.map((row) => ({
    date: (row.date_start ?? row.date_stop ?? '').slice(5),
    spend: Number(row.spend || 0),
  }));

  if (data.summary.length === 0) {
    return (
      <KpiEmptyState variant="jarvis" description="Verifica META_ACCESS_TOKEN y permisos ads_read" />
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiHudMetric label="Spend 30d" value={`$${spend.toFixed(2)}`} icon={DollarSign} accent="amber" spark={chartData.map((d) => d.spend)} />
        <KpiHudMetric label="Impressions" value={impressions.toLocaleString()} icon={Eye} accent="violet" />
        <KpiHudMetric label="Clicks" value={clicks.toLocaleString()} icon={MousePointerClick} accent="cyan" />
        <KpiHudMetric label="CTR" value={`${ctr}%`} icon={Percent} accent="emerald" />
        <KpiHudMetric label="CPM" value={`$${cpm}`} icon={Megaphone} accent="rose" />
        <KpiHudMetric label="CPC" value={`$${cpc}`} icon={Target} accent="blue" />
      </div>

      <KpiJarvisPanel title="Daily Spend" subtitle={`Inversión diaria · ${range}d`} accent="amber">
        {chartData.length > 0 ? (
          <KpiJarvisAreaChart
            data={chartData}
            xKey="date"
            series={[{ dataKey: 'spend', name: 'Spend USD', color: '#fbbf24' }]}
            height={260}
          />
        ) : (
          <KpiEmptyState variant="jarvis" />
        )}
      </KpiJarvisPanel>

      <KpiJarvisPanel title="Account Summary" subtitle="Resumen del periodo" accent="cyan">
        <KpiJarvisTable
          rows={data.summary.map((row, i) => ({ ...row, _id: String(i) }))}
          rowKey={(row) => row._id}
          columns={[
            {
              key: 'period',
              header: 'Periodo',
              render: (row) => (
                <span>
                  {row.date_start ?? '—'} → {row.date_stop ?? '—'}
                </span>
              ),
            },
            {
              key: 'spend',
              header: 'Spend',
              render: (row) => (
                <span className="tabular-nums text-amber-200">
                  ${Number(row.spend || 0).toFixed(2)}
                </span>
              ),
            },
            {
              key: 'impressions',
              header: 'Impressions',
              render: (row) => (
                <span className="tabular-nums">{Number(row.impressions || 0).toLocaleString()}</span>
              ),
            },
            {
              key: 'clicks',
              header: 'Clicks',
              render: (row) => (
                <span className="tabular-nums">{Number(row.clicks || 0).toLocaleString()}</span>
              ),
            },
            {
              key: 'ctr',
              header: 'CTR',
              render: (row) => (
                <span className="tabular-nums text-emerald-300">
                  {Number(row.ctr || 0).toFixed(2)}%
                </span>
              ),
            },
          ]}
        />
      </KpiJarvisPanel>
    </>
  );
}
