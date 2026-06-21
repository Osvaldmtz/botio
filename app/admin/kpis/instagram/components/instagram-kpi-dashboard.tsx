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
  const reach7d = data.insights.slice(-7).reduce((s, p) => s + p.reach, 0);
  const views7d = data.insights.slice(-7).reduce((s, p) => s + p.impressions, 0);
  const engaged7d = data.insights.slice(-7).reduce((s, p) => s + p.accounts_engaged, 0);
  const engagementRate = reach7d > 0 ? ((engaged7d / reach7d) * 100).toFixed(1) : '—';

  const chartData = data.insights.map((p) => ({
    date: p.date.slice(5),
    reach: p.reach,
    views: p.impressions,
  }));

  const topPosts = [...data.media]
    .sort((a, b) => b.reach - a.reach || b.like_count - a.like_count)
    .slice(0, 10);

  return (
    <KpiLayout title="Instagram KPIs" subtitle="Reach, views y top posts — Meta Graph API">
      {data.error ? <KpiSectionError title="Instagram API" error={data.error} /> : null}

      {data.insights.length === 0 && data.media.length === 0 ? (
        <KpiEmptyState description="Verifica META_ACCESS_TOKEN e IDs de cuenta" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiMetricCard
              label="Seguidores"
              value={data.followers != null ? data.followers.toLocaleString() : '—'}
            />
            <KpiMetricCard label="Reach 7d" value={reach7d.toLocaleString()} />
            <KpiMetricCard label="Views 7d" value={views7d.toLocaleString()} />
            <KpiMetricCard label="Engagement rate" value={`${engagementRate}%`} />
          </div>

          <section className="rounded-lg border border-bg-border bg-bg p-5">
            <h2 className="text-sm font-semibold text-fg">Reach + views (30 días)</h2>
            <div className="mt-4">
              {chartData.length > 0 ? (
                <KpiLineChart
                  data={chartData}
                  xKey="date"
                  series={[
                    { dataKey: 'reach', name: 'Reach', color: '#10B981' },
                    { dataKey: 'views', name: 'Views', color: '#6366F1' },
                  ]}
                />
              ) : (
                <KpiEmptyState />
              )}
            </div>
          </section>

          <section className="rounded-lg border border-bg-border bg-bg p-5">
            <h2 className="text-sm font-semibold text-fg">Top 10 posts</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-bg-border text-fg-tertiary">
                    <th className="pb-2 pr-4 font-medium">Caption</th>
                    <th className="pb-2 pr-4 font-medium">Tipo</th>
                    <th className="pb-2 pr-4 font-medium">Likes</th>
                    <th className="pb-2 pr-4 font-medium">Comments</th>
                    <th className="pb-2 pr-4 font-medium">Reach</th>
                    <th className="pb-2 font-medium">Saved</th>
                  </tr>
                </thead>
                <tbody>
                  {topPosts.map((post) => (
                    <tr key={post.id} className="border-b border-bg-border/60">
                      <td className="max-w-xs truncate py-2 pr-4 text-fg">
                        {(post.caption ?? '(sin caption)').slice(0, 80)}
                      </td>
                      <td className="py-2 pr-4 text-fg-muted">{post.media_type}</td>
                      <td className="py-2 pr-4 tabular-nums">{post.like_count}</td>
                      <td className="py-2 pr-4 tabular-nums">{post.comments_count}</td>
                      <td className="py-2 pr-4 tabular-nums">{post.reach}</td>
                      <td className="py-2 tabular-nums">{post.saved}</td>
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
