'use client';

import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import type { ChannelAttributionResponse } from '@/lib/ads-attribution-types';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiVividPanel } from '@/components/admin/kpis/vivid/kpi-vivid-panel';

function fmtNum(value: number): string {
  return value.toLocaleString('es-MX');
}

function fmtUsd(value: number | null | undefined): string {
  if (value == null) return '—';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtRoas(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${value.toFixed(1)}x`;
}

function parseFetchError(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error?: unknown }).error;
    if (typeof err === 'string') return err;
  }
  return `HTTP ${status}`;
}

export function AttributionCard() {
  const [data, setData] = useState<ChannelAttributionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/ads/attribution');
        const body: unknown = await res.json();
        if (!res.ok) {
          throw new Error(parseFetchError(body, res.status));
        }
        if (!cancelled) setData(body as ChannelAttributionResponse);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar atribución');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <KpiVividPanel
        title="Atribución por canal"
        subtitle="Últimos 30 días · leads Botio"
        accent="amber"
      >
        <div className="py-8 text-center text-sm text-fg-muted">Cargando…</div>
      </KpiVividPanel>
    );
  }

  if (error) {
    return <KpiSectionError title="Atribución por canal" error={error} />;
  }

  if (!data?.rows?.length) {
    return (
      <KpiVividPanel title="Atribución por canal" subtitle="Últimos 30 días" accent="amber">
        <KpiEmptyState description="Sin datos de atribución." />
      </KpiVividPanel>
    );
  }

  const totalLeads = data.rows.reduce((sum, r) => sum + r.leads, 0);

  return (
    <KpiVividPanel
      title="Atribución por canal"
      subtitle="Últimos 30 días · leads, trials y paid en Botio"
      accent="amber"
    >
      <div className="mb-3 flex items-center gap-2 text-xs text-fg-tertiary">
        <BarChart3 className="h-3.5 w-3.5" />
        {totalLeads} leads totales · CAC/ROAS solo Meta y Google (spend de plataforma)
      </div>

      {data.note ? (
        <p className="mb-4 rounded-lg border border-amber-200/60 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
          {data.note}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left">
          <thead>
            <tr className="border-b border-bg-border text-[11px] font-semibold uppercase tracking-wide text-fg-tertiary">
              <th className="pb-2 pr-4">Canal</th>
              <th className="pb-2 px-2 text-right">Leads</th>
              <th className="pb-2 px-2 text-right">Trials</th>
              <th className="pb-2 px-2 text-right">Paid</th>
              <th className="pb-2 px-2 text-right">CAC</th>
              <th className="pb-2 pl-2 text-right">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.channel} className="border-b border-bg-border/60 last:border-0">
                <td className="py-2.5 pr-4 text-sm font-medium">{row.label}</td>
                <td className="py-2.5 px-2 text-right text-sm tabular-nums">{fmtNum(row.leads)}</td>
                <td className="py-2.5 px-2 text-right text-sm tabular-nums">{fmtNum(row.trials)}</td>
                <td className="py-2.5 px-2 text-right text-sm tabular-nums">{fmtNum(row.paid)}</td>
                <td className="py-2.5 px-2 text-right text-sm tabular-nums text-fg-muted">
                  {fmtUsd(row.cac_usd)}
                </td>
                <td className="py-2.5 pl-2 text-right text-sm tabular-nums text-fg-muted">
                  {fmtRoas(row.roas)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </KpiVividPanel>
  );
}
