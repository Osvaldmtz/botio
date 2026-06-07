'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { AdminShell } from '@/components/admin/admin-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ExperimentCard, type ExperimentCardData } from './experiment-card';
import { cn } from '@/lib/cn';

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

type Experiment = ExperimentCardData & {
  bot_id: string | null;
  variants: Record<string, { first_message?: string }>;
  traffic_split: Record<string, number>;
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

function ConversionBar({ rate, maxRate }: { rate: number; maxRate: number }) {
  const width = maxRate > 0 ? Math.round((rate / maxRate) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-bg-subtle">
      <div
        className="h-full rounded bg-accent transition-all duration-150"
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
    <AdminShell
      title="Experimentos A/B"
      subtitle={`${experiments.length} experimento(s) · polling cada 15s`}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => void loadList()} disabled={refreshing}>
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} strokeWidth={1.5} />
            Actualizar
          </Button>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            {showForm ? 'Cancelar' : 'Nuevo experimento'}
          </Button>
        </>
      }
      aside={
        selected && detail ? (
          <aside className="flex w-full shrink-0 flex-col border-t border-bg-border bg-bg lg:w-[380px] lg:border-l lg:border-t-0">
            <div className="border-b border-bg-border px-4 py-4">
              <h2 className="text-sm font-semibold text-fg">Detalle</h2>
              <p className="text-sm text-fg-muted">{selected.name}</p>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <section>
                <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-fg-tertiary">
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
                <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-fg-tertiary">
                  Outcomes
                </h3>
                {detail.outcomes.map((row) => (
                  <Card key={row.variant} className="mb-2 p-3">
                    <p className="mb-2 text-sm font-medium text-fg">Variante {row.variant}</p>
                    {Object.keys(row.outcomes).length === 0 ? (
                      <p className="text-xs text-fg-tertiary">Sin outcomes aún</p>
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
                  </Card>
                ))}
              </section>
            </div>
          </aside>
        ) : null
      }
    >
      {showForm ? (
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight text-fg">Crear y activar experimento</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-xs text-fg-muted">Nombre</span>
                <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-fg-muted">Bot</span>
                <select
                  value={form.bot_id}
                  onChange={(e) => setForm((f) => ({ ...f, bot_id: e.target.value }))}
                  className="w-full rounded border border-bg-border bg-bg px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
                >
                  {bots.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs text-fg-muted">Descripción</span>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-fg-muted">Variante A (control)</span>
              <textarea
                rows={3}
                value={form.variant_a}
                onChange={(e) => setForm((f) => ({ ...f, variant_a: e.target.value }))}
                className="w-full rounded border border-bg-border bg-bg px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-fg-muted">Variante B</span>
              <textarea
                rows={3}
                value={form.variant_b}
                onChange={(e) => setForm((f) => ({ ...f, variant_b: e.target.value }))}
                className="w-full rounded border border-bg-border bg-bg px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-xs text-fg-muted">Min sample size</span>
                <Input
                  type="number"
                  min={10}
                  value={form.min_sample_size}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, min_sample_size: Number(e.target.value) }))
                  }
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs text-fg-muted">
                  Split A: {form.traffic_split_a}% / B: {100 - form.traffic_split_a}%
                </span>
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={form.traffic_split_a}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, traffic_split_a: Number(e.target.value) }))
                  }
                  className="w-full accent-accent"
                />
              </label>
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creando…' : 'Crear y activar'}
            </Button>
          </form>
        </Card>
      ) : null}

      <div className="space-y-2">
        {experiments.length === 0 ? (
          <Card className="py-12 text-center">
            <p className="text-sm text-fg-muted">No hay experimentos. Crea uno para empezar.</p>
          </Card>
        ) : (
          experiments.map((exp) => (
            <ExperimentCard
              key={exp.id}
              experiment={exp}
              selected={selectedId === exp.id}
              actionLoading={actionLoading}
              onSelect={() => setSelectedId(exp.id === selectedId ? null : exp.id)}
              onAction={(action) => void patchExperiment(exp.id, action)}
            />
          ))
        )}
      </div>
    </AdminShell>
  );
}
