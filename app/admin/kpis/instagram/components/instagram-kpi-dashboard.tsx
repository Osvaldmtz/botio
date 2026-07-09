'use client';

import { useMemo } from 'react';
import { Eye, Heart, Share2, Users, Zap } from 'lucide-react';
import type { InstagramPageData } from '@/lib/kpi/utils';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiVividMetric } from '@/components/admin/kpis/vivid/kpi-vivid-metric';
import { KpiVividPanel } from '@/components/admin/kpis/vivid/kpi-vivid-panel';
import { KpiVividAreaChart } from '@/components/admin/kpis/vivid/kpi-vivid-charts';
import { KpiVividTable } from '@/components/admin/kpis/vivid/kpi-vivid-table';
import { KpiVividPage, sliceByRange } from '@/components/admin/kpis/vivid/kpi-page-shell';
import type { ChartRange } from '@/components/admin/kpis/vivid/kpi-toolbar';

type Props = { data: InstagramPageData };

export function InstagramKpiDashboard({ data }: Props) {
  return (
    <KpiVividPage
      title="Instagram KPIs"
      subtitle="@kalyo_app — reach, impresiones y engagement"
      sources={[{ id: 'ig', label: 'Instagram', ok: !data.error && data.insights.length > 0 }]}
    >
      {({ range }) => (
        <>
          {data.error ? <KpiSectionError title="Instagram API" error={data.error} /> : null}
          <InstagramContent data={data} range={range} />
        </>
      )}
    </KpiVividPage>
  );
}

function InstagramContent({ data, range }: { data: InstagramPageData; range: ChartRange }) {
  const insights = useMemo(() => sliceByRange(data.insights, range), [data.insights, range]);
  const last7 = insights.slice(-7);
  const alcance7d = last7.reduce((s, p) => s + p.reach, 0);
  const impresiones7d = last7.reduce((s, p) => s + p.impressions, 0);
  const engagement7d = last7.reduce((s, p) => s + p.accounts_engaged, 0);
  const profileViews7d = last7.reduce((s, p) => s + p.profile_views, 0);
  const engagementRate = alcance7d > 0 ? ((engagement7d / alcance7d) * 100).toFixed(1) : '—';

  const chartData = insights.map((p) => ({
    date: p.date.slice(5),
    alcance: p.reach,
    impresiones: p.impressions,
    engagement: p.accounts_engaged,
    profile: p.profile_views,
  }));

  const topPosts = [...data.media].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 10);

  if (data.insights.length === 0 && data.media.length === 0) {
    return <KpiEmptyState description="Verifica META_ACCESS_TOKEN" />;
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiVividMetric label="Seguidores" value={data.followers != null ? data.followers.toLocaleString() : '—'} icon={Users} accent="fuchsia" />
        <KpiVividMetric label="Alcance 7d" value={alcance7d.toLocaleString()} icon={Share2} accent="violet" spark={chartData.map((d) => d.alcance)} />
        <KpiVividMetric label="Impresiones 7d" value={impresiones7d.toLocaleString()} icon={Eye} accent="rose" />
        <KpiVividMetric label="Engagement 7d" value={engagement7d.toLocaleString()} hint={`${engagementRate}%`} icon={Heart} accent="emerald" />
        <KpiVividMetric label="Profile views 7d" value={profileViews7d.toLocaleString()} icon={Zap} accent="sky" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <KpiVividPanel title="Reach + Impresiones" subtitle={`${range}d`} accent="fuchsia">
          {chartData.length > 0 ? (
            <KpiVividAreaChart
              data={chartData}
              xKey="date"
              series={[
                { dataKey: 'alcance', name: 'Alcance', color: '#D946EF' },
                { dataKey: 'impresiones', name: 'Impresiones', color: '#8B5CF6' },
              ]}
              height={260}
            />
          ) : (
            <KpiEmptyState />
          )}
        </KpiVividPanel>
        <KpiVividPanel title="Engagement + Profile views" accent="emerald">
          {chartData.length > 0 ? (
            <KpiVividAreaChart
              data={chartData}
              xKey="date"
              series={[
                { dataKey: 'engagement', name: 'Engagement', color: '#10B981' },
                { dataKey: 'profile', name: 'Profile views', color: '#0EA5E9' },
              ]}
              height={260}
            />
          ) : (
            <KpiEmptyState />
          )}
        </KpiVividPanel>
      </div>

      <KpiVividPanel title="Top publicaciones" accent="violet">
        <KpiVividTable
          rows={topPosts}
          rowKey={(p) => p.id}
          columns={[
            { key: 'cap', header: 'Mensaje', render: (p) => <span className="block max-w-md truncate">{(p.caption ?? '(sin mensaje)').slice(0, 100)}</span> },
            { key: 'type', header: 'Tipo', render: (p) => p.media_type },
            { key: 'date', header: 'Fecha', render: (p) => <span className="tabular-nums">{p.timestamp?.slice(0, 10) ?? '—'}</span> },
          ]}
        />
      </KpiVividPanel>
    </>
  );
}
