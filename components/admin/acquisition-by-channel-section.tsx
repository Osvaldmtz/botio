'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  TrialAcquisitionDays,
  TrialAcquisitionResponse,
} from '@/lib/trial-acquisition-types';

const DAY_OPTIONS: TrialAcquisitionDays[] = [7, 30, 90];

function fmtNum(value: number): string {
  return value.toLocaleString('es-MX');
}

function parseFetchError(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error?: unknown }).error;
    if (typeof err === 'string') return err;
  }
  return `HTTP ${status}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-bg-border bg-bg p-5">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function AcquisitionByChannelSection() {
  const [days, setDays] = useState<TrialAcquisitionDays>(30);
  const [data, setData] = useState<TrialAcquisitionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (range: TrialAcquisitionDays) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/trial-acquisition?days=${range}`);
      const body: unknown = await res.json();
      if (!res.ok) throw new Error(parseFetchError(body, res.status));
      setData(body as TrialAcquisitionResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar adquisición');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  return (
    <Section title="Adquisición">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          Trials por canal (utm_source / utm_medium) · psyplatform
        </p>
        <div className="flex rounded-lg border border-bg-border bg-bg-subtle p-1">
          {DAY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDays(option)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                days === option
                  ? 'bg-accent text-white'
                  : 'text-fg-muted hover:bg-bg hover:text-fg'
              }`}
            >
              {option} días
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-fg-muted">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-semantic-hot">{error}</p>
      ) : !data?.rows.length ? (
        <p className="text-sm text-fg-muted">Sin trials en el periodo seleccionado.</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-fg-tertiary">
            {fmtNum(data.total_trials)} trials con trial_ends_at · últimos {data.days} días
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-left text-sm">
              <thead>
                <tr className="border-b border-bg-border text-[11px] font-semibold uppercase tracking-wide text-fg-tertiary">
                  <th className="pb-2 pr-4">Canal</th>
                  <th className="pb-2 px-2 text-right">Trials</th>
                  <th className="pb-2 pl-2 text-right">% del total</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.channel} className="border-b border-bg-border/60 last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{row.channel}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{fmtNum(row.trials)}</td>
                    <td className="py-2.5 pl-2 text-right tabular-nums text-fg-muted">
                      {row.pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Section>
  );
}
