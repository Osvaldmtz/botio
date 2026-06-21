'use client';

import type { WebPageData } from '@/lib/kpi/utils';
import { KpiLayout } from '@/components/admin/kpis/kpi-layout';
import { KpiMetricCard } from '@/components/admin/kpis/kpi-metric-card';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiDualBarChart } from '@/components/admin/kpis/kpi-charts';

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
  summary,
  pages,
}: {
  title: string;
  summary: WebPageData['landingSummary'];
  pages: WebPageData['landingPages'];
}) {
  return (
    <section className="rounded-lg border border-bg-border bg-bg p-5">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiMetricCard label="Usuarios" value={summary.users.toLocaleString()} />
        <KpiMetricCard label="Sesiones" value={summary.sessions.toLocaleString()} />
        <KpiMetricCard label="Engagement rate" value={`${summary.engagementRate.toFixed(1)}%`} />
        <KpiMetricCard label="Bounce rate" value={`${summary.bounceRate.toFixed(1)}%`} />
        <KpiMetricCard label="Avg duration" value={fmtDuration(summary.avgDuration)} />
      </div>

      <div className="mt-6 overflow-x-auto">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-tertiary">
          Top páginas
        </h3>
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-bg-border text-fg-tertiary">
              <th className="pb-2 pr-4 font-medium">Path</th>
              <th className="pb-2 pr-4 font-medium">Views</th>
              <th className="pb-2 font-medium">Avg duration</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.pagePath} className="border-b border-bg-border/60">
                <td className="max-w-xs truncate py-2 pr-4 text-fg">{page.pagePath}</td>
                <td className="py-2 pr-4 tabular-nums">{page.screenPageViews.toLocaleString()}</td>
                <td className="py-2 tabular-nums">{fmtDuration(page.averageSessionDuration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function WebKpiDashboard({ data }: Props) {
  const mergedDates = Array.from(
    new Set([...data.landing.map((d) => d.date), ...data.app.map((d) => d.date)]),
  ).sort();

  const landingMap = new Map(data.landing.map((d) => [d.date, d.users]));
  const appMap = new Map(data.app.map((d) => [d.date, d.users]));

  const chartData = mergedDates.map((date) => ({
    date: date.slice(5),
    landing: landingMap.get(date) ?? 0,
    app: appMap.get(date) ?? 0,
  }));

  return (
    <KpiLayout title="Web KPIs" subtitle="GA4 Landing (531207061) vs App (539858946)">
      {data.error ? <KpiSectionError title="Google Analytics 4" error={data.error} /> : null}

      {data.landing.length === 0 && data.app.length === 0 ? (
        <KpiEmptyState description="Configura GOOGLE_CREDENTIALS_JSON (Vercel) o GOOGLE_APPLICATION_CREDENTIALS (local)" />
      ) : (
        <>
          <section className="rounded-lg border border-bg-border bg-bg p-5">
            <h2 className="text-sm font-semibold text-fg">Usuarios diarios (30 días)</h2>
            <div className="mt-4">
              {chartData.length > 0 ? (
                <KpiDualBarChart
                  data={chartData}
                  xKey="date"
                  leftKey="landing"
                  rightKey="app"
                  leftLabel="Landing"
                  rightLabel="App"
                />
              ) : (
                <KpiEmptyState />
              )}
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <PropertySection title="Landing" summary={data.landingSummary} pages={data.landingPages} />
            <PropertySection title="App" summary={data.appSummary} pages={data.appPages} />
          </div>
        </>
      )}
    </KpiLayout>
  );
}
