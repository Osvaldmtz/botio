'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ConversationsNav } from '@/app/admin/conversations/components/conversations-nav';

type VariantResult = {
  name: string;
  count: number;
  conversions: number;
  conversion_rate: number;
};

type ExperimentResults = {
  variants: VariantResult[];
  winner?: string;
  p_value?: number;
  sample_ready: boolean;
};

type Experiment = {
  id: string;
  name: string;
  description: string | null;
  bot_id: string | null;
  scope: string;
  status: string;
  variants: Record<string, { first_message?: string }>;
  traffic_split: Record<string, number>;
  winner_variant: string | null;
  min_sample_size: number;
  created_at: string;
  ended_at: string | null;
  results?: ExperimentResults;
};

type OutcomeBreakdown = {
  variant: string;
  outcomes: Record<string, number>;
};

type Bot = { id: string; name: string };

type Defaults = {
  botId: string;
  variantA: string;
};

type Props = {
  initial: {
    experiments: Experiment[];
    bots: Bot[];
    defaults: Defaults;
    fetchedAt: string;
  };
};

const POLL_MS = 15_000;

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  paused: 'Pausado',
  completed: 'Completado',
  archived: 'Archivado',
};

function statusBadgeClass(status: string): string {
  if (status === 'active') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (status === 'paused') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  if (status === 'completed') return 'bg-accent/15 text-accent border-accent/30';
  return 'bg-bg-border/50 text-fg-muted border-bg-border';
}

function ConversionBar({ rate, maxRate }: { rate: number; maxRate: number }) {
  const width = maxRate > 0 ? Math.round((rate / maxRate) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-bg-border">
      <div
        className="h-full rounded-full bg-accent transition-all"
        style={{ width: `${Math.max(width, rate > 0 ? 4 : 0)}%` }}
      />
    </div>
  );
}

export function ExperimentsDashboard({ initial }: Props) {
  const [experiments, setExperiments] = useState(initial.experiments);
  const [bots] = useState(initial.bots);
  const [defaults] = useState(initial.defaults);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    outcomes: OutcomeBreakdown[];
    results: ExperimentResults;
  } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    bot_id: defaults.botId,
    scope: 'first_message',
    variant_a: defaults.variantA,
    variant_b: defaults.variantA,
    min_sample_size: 50,
    traffic_split_a: 50,
  });

  const loadList = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/experiments');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setExperiments(data.experiments);
    } catch (error) {
      console.error('[experiments] refresh failed', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/experiments/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDetail({ outcomes: data.outcomes, results: data.results });
    } catch (error) {
      console.error('[experiments] detail failed', error);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => void loadList(), POLL_MS);
    return () => clearInterval(interval);
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  async function handleCreate(e: { preventDefault: () => void }) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          bot_id: form.bot_id,
          scope: form.scope,
          variant_a: form.variant_a,
          variant_b: form.variant_b,
          min_sample_size: form.min_sample_size,
          traffic_split_a: form.traffic_split_a / 100,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setShowForm(false);
      setForm((f) => ({ ...f, name: '', description: '' }));
      await loadList();
    } catch (error) {
      console.error('[experiments] create failed', error);
      alert(error instanceof Error ? error.message : 'Error al crear');
    } finally {
      setSubmitting(false);
    }
  }

  async function patchExperiment(id: string, action: string) {
    setActionLoading(`${id}-${action}`);
    try {
      const res = await fetch(`/api/admin/experiments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadList();
      if (selectedId === id) await loadDetail(id);
    } catch (error) {
      console.error('[experiments] action failed', error);
    } finally {
      setActionLoading(null);
    }
  }

  const selected = experiments.find((e) => e.id === selectedId);
  const maxRate = Math.max(
    ...(selected?.results?.variants ?? []).map((v) => v.conversion_rate),
    1,
  );

  return (
    <div className="flex h-screen max-h-screen min-h-0 flex-col overflow-hidden bg-bg lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="border-b border-bg-border px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-fg">Experimentos A/B</h1>
              <p className="text-sm text-fg-muted">
                {experiments.length} experimento(s) · polling cada 15s
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ConversationsNav />
              <Link
                href="/admin"
                className="shrink-0 rounded-lg border border-bg-border px-3 py-2 text-sm text-fg-muted hover:text-fg"
              >
                ← Admin
              </Link>
            </div>
          </div>
        </header>

        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20"
            >
              {showForm ? 'Cancelar' : 'Nuevo experimento'}
            </button>
            <button
              type="button"
              onClick={() => void loadList()}
              disabled={refreshing}
              className="rounded-lg border border-bg-border px-3 py-2 text-sm text-fg-muted hover:text-fg disabled:opacity-50"
            >
              {refreshing ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>

          {showForm ? (
            <form
              onSubmit={handleCreate}
              className="space-y-4 rounded-xl border border-bg-border bg-bg-elevated p-4"
            >
              <h2 className="text-lg font-semibold text-fg">Crear y activar experimento</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs text-fg-muted">Nombre</span>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-bg-border bg-bg px-3 py-2 text-sm text-fg"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-fg-muted">Bot</span>
                  <select
                    value={form.bot_id}
                    onChange={(e) => setForm((f) => ({ ...f, bot_id: e.target.value }))}
                    className="w-full rounded-lg border border-bg-border bg-bg px-3 py-2 text-sm text-fg"
                  >
                    {bots.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-xs text-fg-muted">Descripción</span>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg border border-bg-border bg-bg px-3 py-2 text-sm text-fg"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-fg-muted">Scope</span>
                <select
                  value={form.scope}
                  onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
                  className="w-full rounded-lg border border-bg-border bg-bg px-3 py-2 text-sm text-fg sm:max-w-xs"
                >
                  <option value="first_message">first_message</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-fg-muted">Variante A (control)</span>
                <textarea
                  rows={3}
                  value={form.variant_a}
                  onChange={(e) => setForm((f) => ({ ...f, variant_a: e.target.value }))}
                  className="w-full rounded-lg border border-bg-border bg-bg px-3 py-2 text-sm text-fg"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-fg-muted">Variante B</span>
                <textarea
                  rows={3}
                  value={form.variant_b}
                  onChange={(e) => setForm((f) => ({ ...f, variant_b: e.target.value }))}
                  className="w-full rounded-lg border border-bg-border bg-bg px-3 py-2 text-sm text-fg"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs text-fg-muted">Min sample size</span>
                  <input
                    type="number"
                    min={10}
                    value={form.min_sample_size}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, min_sample_size: Number(e.target.value) }))
                    }
                    className="w-full rounded-lg border border-bg-border bg-bg px-3 py-2 text-sm text-fg"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs text-fg-muted">
                    Traffic split A: {form.traffic_split_a}% / B: {100 - form.traffic_split_a}%
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    value={form.traffic_split_a}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, traffic_split_a: Number(e.target.value) }))
                    }
                    className="w-full"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {submitting ? 'Creando…' : 'Crear y activar'}
              </button>
            </form>
          ) : null}

          <div className="space-y-3">
            {experiments.length === 0 ? (
              <p className="rounded-xl border border-bg-border bg-bg-elevated p-6 text-center text-sm text-fg-muted">
                No hay experimentos. Crea uno para empezar.
              </p>
            ) : (
              experiments.map((exp) => {
                const results = exp.results;
                const maxExpRate = Math.max(
                  ...(results?.variants ?? []).map((v) => v.conversion_rate),
                  1,
                );
                const winner = exp.winner_variant ?? results?.winner;

                return (
                  <article
                    key={exp.id}
                    className={`cursor-pointer rounded-xl border bg-bg-elevated p-4 transition-colors ${
                      selectedId === exp.id
                        ? 'border-accent/50 ring-1 ring-accent/30'
                        : 'border-bg-border hover:border-accent/30'
                    }`}
                    onClick={() => setSelectedId(exp.id === selectedId ? null : exp.id)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-fg">{exp.name}</h3>
                        {exp.description ? (
                          <p className="mt-1 text-sm text-fg-muted">{exp.description}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(exp.status)}`}
                          >
                            {STATUS_LABELS[exp.status] ?? exp.status}
                          </span>
                          <span className="rounded-full border border-bg-border px-2 py-0.5 text-xs text-fg-muted">
                            {exp.scope}
                          </span>
                          {winner ? (
                            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs text-accent">
                              Ganador: {winner}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                        {exp.status === 'active' ? (
                          <button
                            type="button"
                            disabled={actionLoading === `${exp.id}-pause`}
                            onClick={() => void patchExperiment(exp.id, 'pause')}
                            className="rounded-lg border border-bg-border px-3 py-1.5 text-xs text-fg-muted hover:text-fg"
                          >
                            Pausar
                          </button>
                        ) : null}
                        {exp.status === 'paused' ? (
                          <button
                            type="button"
                            disabled={actionLoading === `${exp.id}-resume`}
                            onClick={() => void patchExperiment(exp.id, 'resume')}
                            className="rounded-lg border border-bg-border px-3 py-1.5 text-xs text-fg-muted hover:text-fg"
                          >
                            Reanudar
                          </button>
                        ) : null}
                        {winner && exp.status !== 'completed' ? (
                          <button
                            type="button"
                            disabled={actionLoading === `${exp.id}-promote_winner`}
                            onClick={() => void patchExperiment(exp.id, 'promote_winner')}
                            className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs text-accent"
                          >
                            Promover ganador
                          </button>
                        ) : null}
                        {exp.status === 'active' || exp.status === 'paused' ? (
                          <button
                            type="button"
                            disabled={actionLoading === `${exp.id}-stop`}
                            onClick={() => void patchExperiment(exp.id, 'stop')}
                            className="rounded-lg border border-bg-border px-3 py-1.5 text-xs text-fg-muted hover:text-fg"
                          >
                            Detener
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {results?.variants?.length ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {results.variants.map((v) => (
                          <div key={v.name} className="rounded-lg border border-bg-border p-3">
                            <div className="mb-2 flex items-center justify-between text-sm">
                              <span className="font-medium text-fg">
                                Variante {v.name}
                                {winner === v.name ? ' ★' : ''}
                              </span>
                              <span className="tabular-nums text-fg-muted">
                                {v.conversions}/{v.count} ({v.conversion_rate}%)
                              </span>
                            </div>
                            <ConversionBar rate={v.conversion_rate} maxRate={maxExpRate} />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {results?.p_value !== undefined ? (
                      <p className="mt-3 text-xs text-fg-muted">
                        p-value: {results.p_value}
                        {results.sample_ready ? ' · muestra suficiente' : ' · acumulando muestra'}
                      </p>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>

      {selected && detail ? (
        <aside className="flex w-full shrink-0 flex-col border-t border-bg-border bg-bg-elevated lg:w-[380px] lg:border-l lg:border-t-0">
          <div className="border-b border-bg-border px-4 py-3">
            <h2 className="font-semibold text-fg">Detalle</h2>
            <p className="text-sm text-fg-muted">{selected.name}</p>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
                Conversión por variante
              </h3>
              {detail.results.variants.map((v) => (
                <div key={v.name} className="mb-3">
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{v.name}</span>
                    <span className="tabular-nums text-fg-muted">{v.conversion_rate}%</span>
                  </div>
                  <ConversionBar rate={v.conversion_rate} maxRate={maxRate} />
                </div>
              ))}
            </section>

            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
                Outcomes desglosados
              </h3>
              {detail.outcomes.map((row) => (
                <div key={row.variant} className="mb-3 rounded-lg border border-bg-border p-3">
                  <p className="mb-2 text-sm font-medium text-fg">Variante {row.variant}</p>
                  {Object.keys(row.outcomes).length === 0 ? (
                    <p className="text-xs text-fg-muted">Sin outcomes aún</p>
                  ) : (
                    <ul className="space-y-1 text-xs text-fg-muted">
                      {Object.entries(row.outcomes).map(([type, count]) => (
                        <li key={type} className="flex justify-between">
                          <span>{type}</span>
                          <span className="tabular-nums">{count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>

            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
                Payloads
              </h3>
              {Object.entries(selected.variants).map(([key, val]) => (
                <div key={key} className="mb-3">
                  <p className="mb-1 text-xs font-medium text-fg">Variante {key}</p>
                  <p className="rounded-lg border border-bg-border bg-bg p-2 text-xs text-fg-muted">
                    {val.first_message ?? '(sin first_message)'}
                  </p>
                </div>
              ))}
            </section>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
