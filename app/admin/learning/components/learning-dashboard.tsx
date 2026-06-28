'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { KpiVividPieChart } from '@/components/admin/kpis/vivid/kpi-vivid-charts';
import { CONVERSATION_OUTCOMES, outcomeLabel } from '@/lib/conversation-outcome';

type DistributionItem = {
  outcome: string;
  label: string;
  count: number;
  percent: number;
};

type Metrics = {
  total: number;
  with_outcome: number;
  unmarked: number;
  paid: number;
  trial_activated: number;
  lost_total: number;
  conversion_rate: number;
  no_response_rate: number;
  paid_over_trial_rate: number;
};

type ConversationRow = {
  id: string;
  customer_phone: string;
  outcome: string | null;
  outcome_date: string | null;
  outcome_source: string | null;
  last_message_at: string | null;
  lead_score: number | null;
  pipeline_stage: string | null;
  metadata: Record<string, unknown> | null;
};

type ApiResponse = {
  distribution: DistributionItem[];
  metrics: Metrics;
  conversations: ConversationRow[];
};

const OUTCOME_FILTER_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'unmarked', label: 'Sin marcar' },
  ...CONVERSATION_OUTCOMES.map((o) => ({ value: o, label: outcomeLabel(o) })),
];

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-bg-border bg-bg p-4">
      <p className="text-xs uppercase tracking-wide text-fg-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-fg">{value}</p>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function LearningDashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sinceFilter, setSinceFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (outcomeFilter) params.set('outcome', outcomeFilter);
      if (sourceFilter) params.set('source', sourceFilter);
      if (sinceFilter) params.set('since', sinceFilter);
      const qs = params.toString();
      const res = await fetch(`/api/admin/learning${qs ? `?${qs}` : ''}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setData((await res.json()) as ApiResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [outcomeFilter, sourceFilter, sinceFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const pieData =
    data?.distribution.map((row) => ({
      name: `${row.label} (${row.percent}%)`,
      value: row.count,
    })) ?? [];

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Tasa conversión (paid)"
            value={`${data.metrics.conversion_rate}%`}
          />
          <MetricCard
            label="Sin respuesta (30d)"
            value={`${data.metrics.no_response_rate}%`}
          />
          <MetricCard
            label="Paid / trial activado"
            value={
              data.metrics.trial_activated > 0
                ? `${data.metrics.paid_over_trial_rate}%`
                : '—'
            }
          />
          <MetricCard
            label="Con outcome"
            value={`${data.metrics.with_outcome} / ${data.metrics.total}`}
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-bg-border bg-bg p-4">
          <h2 className="mb-4 text-sm font-semibold text-fg">Distribución de outcomes</h2>
          {loading ? (
            <p className="text-sm text-fg-muted">Cargando…</p>
          ) : pieData.length > 0 ? (
            <KpiVividPieChart data={pieData} height={280} />
          ) : (
            <p className="text-sm text-fg-muted">Sin datos aún.</p>
          )}
        </div>

        <div className="rounded-lg border border-bg-border bg-bg p-4">
          <h2 className="mb-4 text-sm font-semibold text-fg">Desglose</h2>
          {data?.distribution.length ? (
            <ul className="space-y-2 text-sm">
              {data.distribution.map((row) => (
                <li key={row.outcome} className="flex justify-between gap-4">
                  <span className="text-fg">{row.label}</span>
                  <span className="tabular-nums text-fg-muted">
                    {row.count} ({row.percent}%)
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">Sin datos aún.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-bg-border bg-bg p-4">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <h2 className="mr-auto text-sm font-semibold text-fg">
            Últimas conversaciones con outcome
          </h2>
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            Outcome
            <select
              className="rounded border border-bg-border bg-bg-subtle px-2 py-1.5 text-sm text-fg"
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
            >
              {OUTCOME_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            Source
            <input
              type="text"
              placeholder="stripe_webhook…"
              className="rounded border border-bg-border bg-bg-subtle px-2 py-1.5 text-sm text-fg"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            Desde (outcome_date)
            <input
              type="date"
              className="rounded border border-bg-border bg-bg-subtle px-2 py-1.5 text-sm text-fg"
              value={sinceFilter}
              onChange={(e) => setSinceFilter(e.target.value)}
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-bg-border text-xs uppercase text-fg-muted">
                <th className="py-2 pr-3">Teléfono</th>
                <th className="py-2 pr-3">Outcome</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Fecha outcome</th>
                <th className="py-2 pr-3">Pipeline</th>
                <th className="py-2">Ver</th>
              </tr>
            </thead>
            <tbody>
              {(data?.conversations ?? []).map((row) => (
                <tr key={row.id} className="border-b border-bg-border/60">
                  <td className="py-2 pr-3 font-mono text-xs">{row.customer_phone}</td>
                  <td className="py-2 pr-3">{outcomeLabel(row.outcome)}</td>
                  <td className="py-2 pr-3 text-fg-muted">{row.outcome_source ?? '—'}</td>
                  <td className="py-2 pr-3 text-fg-muted">{formatDate(row.outcome_date)}</td>
                  <td className="py-2 pr-3 text-fg-muted">{row.pipeline_stage ?? '—'}</td>
                  <td className="py-2">
                    <Link
                      href={`/admin/conversations/${row.id}`}
                      className="text-accent hover:underline"
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && (data?.conversations.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-fg-muted">Sin conversaciones.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
