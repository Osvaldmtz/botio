'use client';

import { useCallback, useEffect, useState } from 'react';

type DistributionRow = {
  reason: string;
  emoji: string;
  label: string;
  count: number;
  pct: number;
  trend_vs_prev_30d: number;
};

type Metrics = {
  total_closed_30d: number;
  conversion_rate_30d: number;
  top_loss_reason: {
    reason: string;
    label: string;
    emoji: string;
    pct: number;
  } | null;
};

type ApiResponse = {
  metrics: Metrics;
  distribution: DistributionRow[];
  insights: string[];
};

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-bg-border bg-bg p-4">
      <p className="text-xs uppercase tracking-wide text-fg-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-fg">{value}</p>
    </div>
  );
}

function trendLabel(trend: number): string {
  if (trend > 0) return `↑ ${trend}%`;
  if (trend < 0) return `↓ ${Math.abs(trend)}%`;
  return '—';
}

export function ClosuresAnalyticsDashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/analytics/closures');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setData((await res.json()) as ApiResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <p className="text-sm text-fg-muted">Cargando métricas…</p>;
  }

  if (error) {
    return <p className="text-sm text-semantic-hot">{error}</p>;
  }

  if (!data) return null;

  const maxCount = Math.max(...data.distribution.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Cerradas (30d)"
          value={String(data.metrics.total_closed_30d)}
        />
        <MetricCard
          label="Tasa conversión"
          value={`${data.metrics.conversion_rate_30d}%`}
        />
        <MetricCard
          label="Razón #1 pérdida"
          value={
            data.metrics.top_loss_reason
              ? `${data.metrics.top_loss_reason.emoji} ${data.metrics.top_loss_reason.label}`
              : '—'
          }
        />
      </div>

      {data.insights.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-bg-border bg-bg-subtle/50 p-4">
          <h3 className="text-sm font-semibold text-fg">Insights</h3>
          {data.insights.map((insight) => (
            <p key={insight} className="text-sm text-fg-muted">
              {insight}
            </p>
          ))}
        </div>
      ) : null}

      <section className="rounded-lg border border-bg-border p-4">
        <h3 className="text-sm font-semibold text-fg">Distribución por razón</h3>
        <div className="mt-4 space-y-3">
          {data.distribution.map((row) => (
            <div key={row.reason} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {row.emoji} {row.label}
                </span>
                <span className="text-fg-muted">
                  {row.count} ({row.pct}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-bg-subtle">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${(row.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="overflow-x-auto rounded-lg border border-bg-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-bg-subtle text-xs uppercase text-fg-muted">
            <tr>
              <th className="px-4 py-3">Razón</th>
              <th className="px-4 py-3">Cantidad</th>
              <th className="px-4 py-3">%</th>
              <th className="px-4 py-3">Tendencia vs 30d ant.</th>
            </tr>
          </thead>
          <tbody>
            {data.distribution.map((row) => (
              <tr key={row.reason} className="border-t border-bg-border">
                <td className="px-4 py-3">
                  {row.emoji} {row.label}
                </td>
                <td className="px-4 py-3">{row.count}</td>
                <td className="px-4 py-3">{row.pct}%</td>
                <td className="px-4 py-3">{trendLabel(row.trend_vs_prev_30d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
