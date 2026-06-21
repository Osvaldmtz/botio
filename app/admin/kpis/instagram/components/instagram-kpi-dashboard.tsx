'use client';

import { useMemo } from 'react';
import { Heart, Share2, Users, Zap } from 'lucide-react';
import type { InstagramPageData } from '@/lib/kpi/utils';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiHudMetric } from '@/components/admin/kpis/jarvis/kpi-hud-metric';
import { KpiJarvisPanel } from '@/components/admin/kpis/jarvis/kpi-jarvis-theme';
import { KpiJarvisAreaChart } from '@/components/admin/kpis/jarvis/kpi-area-chart';
import { KpiJarvisTable } from '@/components/admin/kpis/jarvis/kpi-jarvis-table';
import { KpiJarvisPage, sliceByRange } from '@/components/admin/kpis/jarvis/kpi-page-shell';

type Props = {
  data: InstagramPageData;
};

export function InstagramKpiDashboard({ data }: Props) {
  return (
    <KpiJarvisPage
      title="Instagram KPIs"
      subtitle="Social Radar — @kalyo_app via Graph API"
      sources={[{ id: 'ig', label: 'Instagram', ok: !data.error && data.insights.length > 0 }]}
    >
      {({ range }) => (
        <>
          {data.error ? (
            <KpiSectionError title="Instagram API" error={data.error} variant="jarvis" />
          ) : null}
          <InstagramContent data={data} range={range} />
        </>
      )}
    </KpiJarvisPage>
  );
}

function InstagramContent({
  data,
  range,
}: {
  data: InstagramPageData;
  range: 7 | 14 | 30;
}) {
  const insights = useMemo(() => sliceByRange(data.insights, range), [data.insights, range]);
  const alcance7d = insights.slice(-7).reduce((s, p) => s + p.reach, 0);
  const impresiones7d = insights.slice(-7).reduce((s, p) => s + p.impressions, 0);
  const engagement7d = insights.slice(-7).reduce((s, p) => s + p.accounts_engaged, 0);
  const engagementRate =
    alcance7d > 0 ? ((engagement7d / alcance7d) * 100).toFixed(1) : '—';

  const chartData = insights.map((p) => ({
    date: p.date.slice(5),
    alcance: p.reach,
    impresiones: p.impressions,
  }));

  const topPosts = [...data.media]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 10);

  if (data.insights.length === 0 && data.media.length === 0) {
    return (
      <KpiEmptyState
        variant="jarvis"
        description="Verifica META_ACCESS_TOKEN y permisos instagram_manage_insights"
      />
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiHudMetric
          label="Seguidores"
          value={data.followers != null ? data.followers.toLocaleString() : '—'}
          icon={Users}
          accent="violet"
        />
        <KpiHudMetric
          label="Alcance 7d"
          value={alcance7d.toLocaleString()}
          icon={Share2}
          accent="violet"
          spark={chartData.map((d) => d.alcance)}
        />
        <KpiHudMetric
          label="Impresiones 7d"
          value={impresiones7d.toLocaleString()}
          icon={Zap}
          accent="rose"
        />
        <KpiHudMetric
          label="Engagement 7d"
          value={engagement7d.toLocaleString()}
          hint={`${engagementRate}% vs alcance`}
          icon={Heart}
          accent="emerald"
        />
      </div>

      <KpiJarvisPanel
        title="Reach + Impressions"
        subtitle={`Serie diaria · ${range}d`}
        accent="violet"
      >
        {chartData.length > 0 ? (
          <KpiJarvisAreaChart
            data={chartData}
            xKey="date"
            series={[
              { dataKey: 'alcance', name: 'Alcance', color: '#a78bfa' },
              { dataKey: 'impresiones', name: 'Impresiones', color: '#f472b6' },
            ]}
            height={260}
          />
        ) : (
          <KpiEmptyState variant="jarvis" description="Sin insights en el periodo" />
        )}
      </KpiJarvisPanel>

      <KpiJarvisPanel title="Top Posts" subtitle="Últimas 10 publicaciones" accent="rose">
        <KpiJarvisTable
          rows={topPosts}
          rowKey={(p) => p.id}
          columns={[
            {
              key: 'caption',
              header: 'Mensaje',
              render: (p) => (
                <span className="block max-w-md truncate">
                  {(p.caption ?? '(sin mensaje)').slice(0, 100)}
                </span>
              ),
            },
            {
              key: 'type',
              header: 'Tipo',
              render: (p) => <span className="text-slate-400">{p.media_type}</span>,
            },
            {
              key: 'date',
              header: 'Fecha',
              render: (p) => (
                <span className="tabular-nums text-slate-400">
                  {p.timestamp ? p.timestamp.slice(0, 10) : '—'}
                </span>
              ),
            },
          ]}
        />
      </KpiJarvisPanel>
    </>
  );
}
