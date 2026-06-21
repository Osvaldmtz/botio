'use client';

import { useMemo } from 'react';
import { Clock, MousePointerClick, TrendingDown, Users } from 'lucide-react';
import type { WebPageData } from '@/lib/kpi/utils';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiVividMetric } from '@/components/admin/kpis/vivid/kpi-vivid-metric';
import { KpiVividPanel } from '@/components/admin/kpis/vivid/kpi-vivid-panel';
import { KpiVividAreaChart, KpiVividBarChart } from '@/components/admin/kpis/vivid/kpi-vivid-charts';
import { KpiVividTable } from '@/components/admin/kpis/vivid/kpi-vivid-table';
import { KpiVividPage, sliceByRange } from '@/components/admin/kpis/vivid/kpi-page-shell';

type Props = { data: WebPageData };

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function PropertyBlock({
  title,
  accent,
  summary,
  pages,
  daily,
  range,
}: {
  title: string;
  accent: 'emerald' | 'sky' | 'violet' | 'indigo';
  summary: WebPageData['landingSummary'];
  pages: WebPageData['landingPages'];
  daily: WebPageData['landing'];
  range: 7 | 14 | 30;
}) {
  const chartData = useMemo(
    () =>
      sliceByRange(daily, range).map((d) => ({
        date: d.date.slice(5),
        users: d.users,
        sessions: d.sessions,
      })),
    [daily, range],
  );

  return (
    <KpiVividPanel title={title} accent={accent === 'indigo' ? 'violet' : accent}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiVividMetric label="Usuarios" value={summary.users.toLocaleString()} icon={Users} accent={accent} compact />
        <KpiVividMetric label="Sesiones" value={summary.sessions.toLocaleString()} icon={MousePointerClick} accent={accent} compact />
        <KpiVividMetric label="Engagement" value={`${summary.engagementRate.toFixed(1)}%`} icon={TrendingDown} accent="emerald" compact />
        <KpiVividMetric label="Bounce" value={`${summary.bounceRate.toFixed(1)}%`} icon={TrendingDown} accent="orange" compact />
        <KpiVividMetric label="Duración avg" value={fmtDuration(summary.avgDuration)} icon={Clock} accent="violet" compact />
      </div>
      {chartData.length > 0 ? (
        <KpiVividAreaChart
          data={chartData}
          xKey="date"
          series={[
            { dataKey: 'users', name: 'Usuarios', color: accent === 'emerald' ? '#10B981' : '#6366F1' },
            { dataKey: 'sessions', name: 'Sesiones', color: accent === 'emerald' ? '#0EA5E9' : '#8B5CF6' },
          ]}
          height={200}
        />
      ) : null}
      <div className="mt-4">
        <KpiVividTable
          rows={pages}
          rowKey={(p) => p.pagePath}
          columns={[
            { key: 'path', header: 'Path', render: (p) => <span className="block max-w-xs truncate">{p.pagePath}</span> },
            { key: 'views', header: 'Views', render: (p) => <span className="tabular-nums">{p.screenPageViews.toLocaleString()}</span> },
            { key: 'dur', header: 'Duración', render: (p) => <span className="tabular-nums">{fmtDuration(p.averageSessionDuration)}</span> },
          ]}
        />
      </div>
    </KpiVividPanel>
  );
}

export function WebKpiDashboard({ data }: Props) {
  return (
    <KpiVividPage
      title="Web KPIs"
      subtitle="GA4 Landing vs App"
      sources={[{ id: 'ga4', label: 'GA4', ok: !data.error && (data.landing.length > 0 || data.app.length > 0) }]}
    >
      {({ range }) => (
        <>
          {data.error ? <KpiSectionError title="Google Analytics 4" error={data.error} /> : null}
          <WebContent data={data} range={range} />
        </>
      )}
    </KpiVividPage>
  );
}

function WebContent({ data, range }: { data: WebPageData; range: 7 | 14 | 30 }) {
  const landing = useMemo(() => sliceByRange(data.landing, range), [data.landing, range]);
  const app = useMemo(() => sliceByRange(data.app, range), [data.app, range]);

  const mergedDates = Array.from(new Set([...landing.map((d) => d.date), ...app.map((d) => d.date)])).sort();
  const landingMap = new Map(landing.map((d) => [d.date, d.users]));
  const appMap = new Map(app.map((d) => [d.date, d.users]));
  const chartData = mergedDates.map((date) => ({
    date: date.slice(5),
    landing: landingMap.get(date) ?? 0,
    app: appMap.get(date) ?? 0,
  }));

  if (data.landing.length === 0 && data.app.length === 0) {
    return <KpiEmptyState description="Configura GOOGLE_CREDENTIALS_JSON" />;
  }

  return (
    <>
      <KpiVividPanel title="Usuarios diarios — Landing vs App" subtitle={`${range}d`} accent="sky">
        {chartData.length > 0 ? (
          <KpiVividBarChart
            data={chartData}
            xKey="date"
            bars={[
              { dataKey: 'landing', name: 'Landing', color: '#10B981' },
              { dataKey: 'app', name: 'App', color: '#6366F1' },
            ]}
            height={260}
          />
        ) : (
          <KpiEmptyState />
        )}
      </KpiVividPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <PropertyBlock title="Landing · kalyo.io" accent="emerald" summary={data.landingSummary} pages={data.landingPages} daily={data.landing} range={range} />
        <PropertyBlock title="App · app.kalyo.io" accent="indigo" summary={data.appSummary} pages={data.appPages} daily={data.app} range={range} />
      </div>
    </>
  );
}
