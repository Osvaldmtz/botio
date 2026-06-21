'use client';

import type { InstagramPageData } from '@/lib/kpi/utils';
import { KpiLayout } from '@/components/admin/kpis/kpi-layout';
import { KpiMetricCard } from '@/components/admin/kpis/kpi-metric-card';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiLineChart } from '@/components/admin/kpis/kpi-charts';

type Props = {
  data: InstagramPageData;
};

export function InstagramKpiDashboard({ data }: Props) {
  const alcance7d = data.insights.slice(-7).reduce((s, p) => s + p.reach, 0);
  const impresiones7d = data.insights.slice(-7).reduce((s, p) => s + p.impressions, 0);
  const engagement7d = data.insights.slice(-7).reduce((s, p) => s + p.accounts_engaged, 0);
  const engagementRate =
    alcance7d > 0 ? ((engagement7d / alcance7d) * 100).toFixed(1) : '—';

  const chartData = data.insights.map((p) => ({
    date: p.date.slice(5),
    alcance: p.reach,
    impresiones: p.impressions,
  }));

  const topPosts = [...data.media]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 10);

  return (
    <KpiLayout
      title="Instagram KPIs"
      subtitle="Instagram Graph API — @kalyo_app"
    >
      {data.error ? <KpiSectionError title="Instagram API" error={data.error} /> : null}

      {data.insights.length === 0 && data.media.length === 0 ? (
        <KpiEmptyState description="Verifica META_ACCESS_TOKEN y permisos instagram_manage_insights" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiMetricCard
              label="Seguidores"
              value={data.followers != null ? data.followers.toLocaleString() : '—'}
            />
            <KpiMetricCard label="Alcance 7d" value={alcance7d.toLocaleString()} />
            <KpiMetricCard label="Impresiones 7d" value={impresiones7d.toLocaleString()} />
            <KpiMetricCard label="Engagement 7d" value={engagement7d.toLocaleString()} hint={`${engagementRate}% vs alcance`} />
          </div>

          <section className="rounded-lg border border-bg-border bg-bg p-5">
            <h2 className="text-sm font-semibold text-fg">Alcance + impresiones (30 días)</h2>
            <div className="mt-4">
              {chartData.length > 0 ? (
                <KpiLineChart
                  data={chartData}
                  xKey="date"
                  series={[
                    { dataKey: 'alcance', name: 'Alcance', color: '#10B981' },
                    { dataKey: 'impresiones', name: 'Impresiones', color: '#6366F1' },
                  ]}
                />
              ) : (
                <KpiEmptyState description="Sin datos de Instagram Insights en el periodo" />
              )}
            </div>
          </section>

          <section className="rounded-lg border border-bg-border bg-bg p-5">
            <h2 className="text-sm font-semibold text-fg">Top 10 publicaciones</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-bg-border text-fg-tertiary">
                    <th className="pb-2 pr-4 font-medium">Mensaje</th>
                    <th className="pb-2 pr-4 font-medium">Tipo</th>
                    <th className="pb-2 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {topPosts.map((post) => (
                    <tr key={post.id} className="border-b border-bg-border/60">
                      <td className="max-w-md truncate py-2 pr-4 text-fg">
                        {(post.caption ?? '(sin mensaje)').slice(0, 100)}
                      </td>
                      <td className="py-2 pr-4 text-fg-muted">{post.media_type}</td>
                      <td className="py-2 tabular-nums text-fg-muted">
                        {post.timestamp ? post.timestamp.slice(0, 10) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </KpiLayout>
  );
}
