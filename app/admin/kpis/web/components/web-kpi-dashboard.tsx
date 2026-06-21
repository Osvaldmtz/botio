'use client';

import { useMemo } from 'react';
import { Clock, MousePointerClick, TrendingDown, Users } from 'lucide-react';
import type { WebPageData } from '@/lib/kpi/utils';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiHudMetric } from '@/components/admin/kpis/jarvis/kpi-hud-metric';
import { KpiJarvisPanel } from '@/components/admin/kpis/jarvis/kpi-jarvis-theme';
import { KpiJarvisBarChart } from '@/components/admin/kpis/jarvis/kpi-bar-chart';
import { KpiJarvisTable } from '@/components/admin/kpis/jarvis/kpi-jarvis-table';
import { KpiJarvisPage, sliceByRange } from '@/components/admin/kpis/jarvis/kpi-page-shell';

type Props = {
  data: WebPageData;
};

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function PropertySection({
  title,
  accent,
  summary,
  pages,
}: {
  title: string;
  accent: 'emerald' | 'cyan' | 'violet' | 'blue';
  summary: WebPageData['landingSummary'];
  pages: WebPageData['landingPages'];
}) {
  return (
    <KpiJarvisPanel title={title} subtitle="Resumen + top páginas" accent={accent === 'blue' ? 'cyan' : accent}>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiHudMetric label="Usuarios" value={summary.users.toLocaleString()} icon={Users} accent={accent} />
        <KpiHudMetric label="Sesiones" value={summary.sessions.toLocaleString()} icon={MousePointerClick} accent={accent} />
        <KpiHudMetric label="Engagement" value={`${summary.engagementRate.toFixed(1)}%`} icon={TrendingDown} accent="emerald" />
        <KpiHudMetric label="Bounce" value={`${summary.bounceRate.toFixed(1)}%`} icon={TrendingDown} accent="amber" />
        <KpiHudMetric label="Avg duration" value={fmtDuration(summary.avgDuration)} icon={Clock} accent="violet" />
      </div>
      <KpiJarvisTable
        rows={pages}
        rowKey={(p) => p.pagePath}
        columns={[
          {
            key: 'path',
            header: 'Path',
            render: (p) => <span className="block max-w-xs truncate">{p.pagePath}</span>,
          },
          {
            key: 'views',
            header: 'Views',
            render: (p) => (
              <span className="tabular-nums">{p.screenPageViews.toLocaleString()}</span>
            ),
          },
          {
            key: 'duration',
            header: 'Avg duration',
            render: (p) => (
              <span className="tabular-nums">{fmtDuration(p.averageSessionDuration)}</span>
            ),
          },
        ]}
      />
    </KpiJarvisPanel>
  );
}

export function WebKpiDashboard({ data }: Props) {
  return (
    <KpiJarvisPage
      title="Web KPIs"
      subtitle="GA4 — Landing (531207061) vs App (539858946)"
      sources={[{ id: 'ga4', label: 'GA4', ok: !data.error && (data.landing.length > 0 || data.app.length > 0) }]}
    >
      {({ range }) => (
        <>
          {data.error ? (
            <KpiSectionError title="Google Analytics 4" error={data.error} variant="jarvis" />
          ) : null}
          <WebContent data={data} range={range} />
        </>
      )}
    </KpiJarvisPage>
  );
}

function WebContent({ data, range }: { data: WebPageData; range: 7 | 14 | 30 }) {
  const landing = useMemo(() => sliceByRange(data.landing, range), [data.landing, range]);
  const app = useMemo(() => sliceByRange(data.app, range), [data.app, range]);

  const mergedDates = Array.from(
    new Set([...landing.map((d) => d.date), ...app.map((d) => d.date)]),
  ).sort();

  const landingMap = new Map(landing.map((d) => [d.date, d.users]));
  const appMap = new Map(app.map((d) => [d.date, d.users]));

  const chartData = mergedDates.map((date) => ({
    date: date.slice(5),
    landing: landingMap.get(date) ?? 0,
    app: appMap.get(date) ?? 0,
  }));

  if (data.landing.length === 0 && data.app.length === 0) {
    return (
      <KpiEmptyState
        variant="jarvis"
        description="Configura GOOGLE_CREDENTIALS_JSON en Vercel"
      />
    );
  }

  return (
    <>
      <KpiJarvisPanel
        title="Traffic Compare"
        subtitle={`Usuarios diarios · ${range}d`}
        accent="cyan"
      >
        {chartData.length > 0 ? (
          <KpiJarvisBarChart
            data={chartData}
            xKey="date"
            bars={[
              { dataKey: 'landing', name: 'Landing', color: '#34d399' },
              { dataKey: 'app', name: 'App', color: '#818cf8' },
            ]}
            height={260}
          />
        ) : (
          <KpiEmptyState variant="jarvis" />
        )}
      </KpiJarvisPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <PropertySection
          title="Landing · kalyo.io"
          accent="emerald"
          summary={data.landingSummary}
          pages={data.landingPages}
        />
        <PropertySection
          title="App · app.kalyo.io"
          accent="blue"
          summary={data.appSummary}
          pages={data.appPages}
        />
      </div>
    </>
  );
}
