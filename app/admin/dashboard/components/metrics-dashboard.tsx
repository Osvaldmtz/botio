'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { StatsHeader } from '@/components/admin/stats-header';
import { CLOSURE_REASON_UI } from '@/lib/conversation-closure-constants';

type MRR = {
  available: boolean;
  current_mrr_usd: number;
  active_subscriptions: number;
  new_subs_this_month: number;
  churned_this_month: number;
  net_growth_mrr_usd: number;
  mrr_growth_pct: number | null;
  error?: string;
};

type Funnel = {
  leads: number;
  conversations: number;
  qualified: number;
  trials_activated: number;
  paid: number;
  conversion_rates: {
    lead_to_qualified: number;
    qualified_to_trial: number;
    trial_to_paid: number;
    overall: number;
  };
};

type ChannelStats = { leads: number; trials: number; paid: number };

type ApiResponse = {
  mrr: MRR;
  funnel: Funnel;
  by_channel: Record<string, ChannelStats>;
  top_objections: Array<{ type: string; label: string; count: number; conversion_rate: number }>;
  closure_breakdown: Record<string, number>;
  trends_30d: Array<{ date: string; leads: number; trials: number; paid: number }>;
  unattended_hot_leads: number;
  insights: string[];
  fetchedAt: string;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-bg-border bg-bg p-5">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FunnelBar({
  label,
  value,
  max,
  rate,
}: {
  label: string;
  value: number;
  max: number;
  rate?: string;
}) {
  const width = max > 0 ? Math.max(8, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-fg-muted">
          {value}
          {rate ? ` · ${rate}` : ''}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-bg-subtle">
        <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function TrendChart({ data }: { data: ApiResponse['trends_30d'] }) {
  const max = Math.max(...data.map((d) => d.leads), 1);
  return (
    <div className="flex h-32 items-end gap-0.5">
      {data.map((day) => {
        const h = (day.leads / max) * 100;
        return (
          <div
            key={day.date}
            title={`${day.date}: ${day.leads} leads, ${day.trials} trials, ${day.paid} paid`}
            className="min-w-0 flex-1 rounded-t bg-accent/70 hover:bg-accent"
            style={{ height: `${Math.max(4, h)}%` }}
          />
        );
      })}
    </div>
  );
}

export function MetricsDashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/metrics');
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
    const interval = setInterval(() => void load(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!data?.fetchedAt) return;
    const tick = setInterval(() => {
      setSecondsAgo(
        Math.floor((Date.now() - new Date(data.fetchedAt).getTime()) / 1000),
      );
    }, 1000);
    return () => clearInterval(tick);
  }, [data?.fetchedAt]);

  if (loading && !data) {
    return (
      <AdminShell title="Dashboard Botio" subtitle="Cargando métricas…">
        <p className="text-sm text-fg-muted">Obteniendo datos de Stripe y Supabase…</p>
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell title="Dashboard Botio">
        <p className="text-sm text-semantic-hot">{error}</p>
      </AdminShell>
    );
  }

  if (!data) return null;

  const { mrr, funnel } = data;
  const maxFunnel = funnel.leads || 1;

  return (
    <AdminShell
      title="📊 Dashboard Botio"
      subtitle={`Última actualización: hace ${secondsAgo}s`}
    >
      <StatsHeader
        items={[
          {
            key: 'mrr',
            label: 'MRR',
            value: mrr.available ? `$${mrr.current_mrr_usd}` : '—',
            hint: mrr.mrr_growth_pct !== null ? `${mrr.mrr_growth_pct > 0 ? '+' : ''}${mrr.mrr_growth_pct}%` : mrr.error,
            delta: mrr.mrr_growth_pct !== null && mrr.mrr_growth_pct > 0 ? 'up' : 'neutral',
          },
          {
            key: 'active',
            label: 'Active subs',
            value: String(mrr.active_subscriptions),
          },
          {
            key: 'new',
            label: 'New este mes',
            value: `+${mrr.new_subs_this_month}`,
            delta: 'up',
          },
          {
            key: 'churn',
            label: 'Churned',
            value: `-${mrr.churned_this_month}`,
            delta: mrr.churned_this_month > 0 ? 'down' : 'neutral',
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="📊 Funnel de conversión (30 días)">
          <div className="space-y-4">
            <FunnelBar label="Leads" value={funnel.leads} max={maxFunnel} />
            <FunnelBar
              label="Qualified"
              value={funnel.qualified}
              max={maxFunnel}
              rate={`↓ ${funnel.conversion_rates.lead_to_qualified}%`}
            />
            <FunnelBar
              label="Trials activos"
              value={funnel.trials_activated}
              max={maxFunnel}
              rate={`↓ ${funnel.conversion_rates.qualified_to_trial}%`}
            />
            <FunnelBar
              label="Paid"
              value={funnel.paid}
              max={maxFunnel}
              rate={`↓ ${funnel.conversion_rates.trial_to_paid}%`}
            />
            <p className="text-sm font-medium text-fg">
              Overall: {funnel.conversion_rates.overall}% leads → paid
            </p>
          </div>
        </Section>

        <Section title="📈 Performance por canal">
          <div className="space-y-3">
            {Object.entries(data.by_channel).map(([channel, stats]) => {
              const rate = stats.leads > 0 ? ((stats.paid / stats.leads) * 100).toFixed(1) : '0.0';
              const label = channel.charAt(0).toUpperCase() + channel.slice(1);
              return (
                <div
                  key={channel}
                  className="flex items-center justify-between rounded border border-bg-border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{label}</span>
                  <span className="text-fg-muted">
                    {stats.leads} leads → {stats.paid} paid ({rate}%)
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="💀 Top objeciones que matan ventas">
          {data.top_objections.length === 0 ? (
            <p className="text-sm text-fg-muted">Sin objeciones registradas en 30d.</p>
          ) : (
            <div className="space-y-2">
              {data.top_objections.map((obj, i) => (
                <div key={obj.type} className="flex justify-between text-sm">
                  <span>
                    {i + 1}. {obj.label}
                  </span>
                  <span className="text-fg-muted">
                    {obj.count} · conv {obj.conversion_rate}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="📋 Cierres por razón (30d)">
          <div className="space-y-2">
            {Object.entries(data.closure_breakdown)
              .filter(([, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([reason, count]) => {
                const ui = CLOSURE_REASON_UI[reason as keyof typeof CLOSURE_REASON_UI];
                return (
                  <div key={reason} className="flex justify-between text-sm">
                    <span>{ui ? `${ui.emoji} ${ui.label}` : reason}</span>
                    <span className="text-fg-muted">{count}</span>
                  </div>
                );
              })}
          </div>
        </Section>
      </div>

      <Section title="📊 Trend últimos 30 días">
        <TrendChart data={data.trends_30d} />
        <p className="mt-2 text-xs text-fg-muted">Barras = nuevos leads por día</p>
      </Section>

      <Section title="💡 Insights automáticos">
        <ul className="space-y-2">
          {data.insights.map((insight) => (
            <li key={insight} className="text-sm text-fg-muted">
              {insight}
            </li>
          ))}
        </ul>
      </Section>

      {data.unattended_hot_leads > 0 ? (
        <p className="rounded-lg border border-semantic-hot/30 bg-semantic-hot-bg px-4 py-3 text-sm text-semantic-hot">
          🚨 {data.unattended_hot_leads} HOT lead(s) sin atender ahora mismo
        </p>
      ) : null}
    </AdminShell>
  );
}
