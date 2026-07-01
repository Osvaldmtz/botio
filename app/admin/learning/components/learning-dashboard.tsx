'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { KpiVividPieChart } from '@/components/admin/kpis/vivid/kpi-vivid-charts';
import { CONVERSATION_OUTCOMES, outcomeLabel } from '@/lib/conversation-outcome-labels';

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

type ActionableInsight = {
  priority: string;
  insight: string;
  suggested_change: string;
};

type LearningInsightRow = {
  id: string;
  generated_at: string;
  period_start: string | null;
  period_end: string | null;
  total_conversations: number | null;
  paid_count: number | null;
  trial_count: number | null;
  lost_count: number | null;
  insights: {
    summary?: string;
    actionable_insights?: ActionableInsight[];
    won_patterns?: string[];
    lost_patterns?: string[];
    objection_analysis?: Record<string, unknown>;
    variant_comparison?: Record<string, unknown>;
  } | null;
  applied: boolean;
  applied_at: string | null;
};

type PeriodComparison = {
  current: {
    total: number;
    won: number;
    lost_no_response: number;
    conversion_rate: number;
    no_response_rate: number;
  };
  previous: {
    total: number;
    won: number;
    lost_no_response: number;
    conversion_rate: number;
    no_response_rate: number;
  };
  conversion_change: number;
  lost_no_response_change: number;
};

type ApiResponse = {
  distribution: DistributionItem[];
  metrics: Metrics;
  conversations: ConversationRow[];
  insights: LearningInsightRow[];
  period_comparison: PeriodComparison;
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

function formatDelta(value: number, suffix = '%'): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${suffix}`;
}

function priorityBadge(priority: string): string {
  if (priority === 'high') return '🔴 Alta';
  if (priority === 'medium') return '🟡 Media';
  return '🟢 Baja';
}

export function LearningDashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sinceFilter, setSinceFilter] = useState('');
  const [appliedFilter, setAppliedFilter] = useState<'all' | 'applied' | 'pending'>('all');
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (outcomeFilter) params.set('outcome', outcomeFilter);
      if (sourceFilter) params.set('source', sourceFilter);
      if (sinceFilter) params.set('since', sinceFilter);
      if (appliedFilter !== 'all') params.set('applied', appliedFilter);
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
  }, [outcomeFilter, sourceFilter, sinceFilter, appliedFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const triggerAnalysis = async () => {
    setTriggering(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/trigger-learning-analysis', { method: 'POST' });
      const body = (await res.json()) as { error?: string; status?: string; reason?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.status === 'skipped') {
        setError(`Análisis omitido: solo ${body.reason === 'insufficient_data' ? 'datos insuficientes (<10 conversaciones con outcome esta semana)' : body.reason}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTriggering(false);
    }
  };

  const applyInsight = async (id: string) => {
    setApplyingId(id);
    try {
      const res = await fetch(`/api/admin/learning/insights/${id}/apply`, { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplyingId(null);
    }
  };

  const pieData =
    data?.distribution.map((row) => ({
      name: `${row.label} (${row.percent}%)`,
      value: row.count,
    })) ?? [];

  const comparison = data?.period_comparison;

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

      {comparison ? (
        <div className="rounded-lg border border-bg-border bg-bg p-4">
          <h2 className="mb-4 text-sm font-semibold text-fg">Esta semana vs semana anterior</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-fg-muted">Conversión (WON / total con outcome)</p>
              <p className="mt-1 text-lg font-semibold text-fg">
                {comparison.current.conversion_rate}%{' '}
                <span
                  className={
                    comparison.conversion_change >= 0 ? 'text-green-600' : 'text-red-600'
                  }
                >
                  ({formatDelta(comparison.conversion_change)})
                </span>
              </p>
              <p className="text-xs text-fg-muted">
                Antes: {comparison.previous.conversion_rate}% · {comparison.current.total} conv.
              </p>
            </div>
            <div>
              <p className="text-xs text-fg-muted">lost_no_response</p>
              <p className="mt-1 text-lg font-semibold text-fg">
                {comparison.current.no_response_rate}%{' '}
                <span
                  className={
                    comparison.lost_no_response_change <= 0 ? 'text-green-600' : 'text-red-600'
                  }
                >
                  ({formatDelta(comparison.lost_no_response_change)})
                </span>
              </p>
              <p className="text-xs text-fg-muted">
                Antes: {comparison.previous.no_response_rate}%
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-bg-border bg-bg p-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="mr-auto text-sm font-semibold text-fg">Insights generados</h2>
          <select
            className="rounded border border-bg-border bg-bg-subtle px-2 py-1.5 text-sm text-fg"
            value={appliedFilter}
            onChange={(e) =>
              setAppliedFilter(e.target.value as 'all' | 'applied' | 'pending')
            }
          >
            <option value="all">Todos</option>
            <option value="pending">No aplicados</option>
            <option value="applied">Aplicados</option>
          </select>
          <button
            type="button"
            onClick={() => void triggerAnalysis()}
            disabled={triggering}
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {triggering ? 'Analizando…' : 'Ejecutar análisis ahora'}
          </button>
        </div>

        {(data?.insights ?? []).length === 0 ? (
          <p className="text-sm text-fg-muted">
            Sin insights aún. El cron corre los lunes 6 AM UTC; necesitas ≥10 conversaciones con
            outcome en la última semana.
          </p>
        ) : (
          <ul className="space-y-3">
            {(data?.insights ?? []).map((row) => {
              const won = (row.paid_count ?? 0) + (row.trial_count ?? 0);
              const total = row.total_conversations ?? 0;
              const convRate =
                total > 0 ? Math.round((won / total) * 1000) / 10 : 0;
              const expanded = expandedInsightId === row.id;

              return (
                <li
                  key={row.id}
                  className="rounded-lg border border-bg-border bg-bg-subtle/50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-fg">
                        {formatDate(row.generated_at)}
                        {row.applied ? (
                          <span className="ml-2 text-xs text-green-600">✓ Aplicado</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-fg-muted">
                        Periodo: {formatDate(row.period_start)} — {formatDate(row.period_end)}
                      </p>
                      <p className="mt-1 text-xs text-fg-muted">
                        {total} conv. · conversión {convRate}% · paid {row.paid_count ?? 0} ·
                        trial {row.trial_count ?? 0} · lost {row.lost_count ?? 0}
                      </p>
                      {row.insights?.summary ? (
                        <p className="mt-2 text-sm text-fg">{row.insights.summary}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedInsightId(expanded ? null : row.id)}
                        className="rounded border border-bg-border px-2 py-1 text-xs text-fg hover:bg-bg"
                      >
                        {expanded ? 'Ocultar' : 'Ver detalle'}
                      </button>
                      {!row.applied ? (
                        <button
                          type="button"
                          onClick={() => void applyInsight(row.id)}
                          disabled={applyingId === row.id}
                          className="rounded border border-accent px-2 py-1 text-xs text-accent hover:bg-accent/10 disabled:opacity-50"
                        >
                          {applyingId === row.id ? '…' : 'Aplicar'}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {expanded && row.insights ? (
                    <div className="mt-4 space-y-3 border-t border-bg-border pt-4 text-sm">
                      {(row.insights.actionable_insights ?? []).map((item, i) => (
                        <div key={i} className="rounded bg-bg p-3">
                          <p className="font-medium text-fg">
                            {i + 1}. {priorityBadge(item.priority)} — {item.insight}
                          </p>
                          <p className="mt-1 text-fg-muted">{item.suggested_change}</p>
                        </div>
                      ))}
                      <pre className="max-h-64 overflow-auto rounded bg-bg p-3 text-xs text-fg-muted">
                        {JSON.stringify(row.insights, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

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
