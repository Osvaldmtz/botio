'use client';

import { useEffect, useState } from 'react';
import { Crown, Megaphone, MousePointerClick, Target } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ChannelCompareResponse, ChannelMetricWinner } from '@/lib/ads-channel-compare-types';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiVividPanel } from '@/components/admin/kpis/vivid/kpi-vivid-panel';

function fmtUsd(value: number | null | undefined): string {
  if (value == null) return '—';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtNative(value: number, currency: 'MXN' | 'COP'): string {
  return `$${value.toLocaleString('es-MX', { maximumFractionDigits: 0 })} ${currency}`;
}

function parseFetchError(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error?: unknown }).error;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object' && 'message' in err) {
      return String((err as { message?: unknown }).message ?? status);
    }
  }
  return `HTTP ${status}`;
}

function winnerLabel(winner: ChannelMetricWinner, metaLabel: string, googleLabel: string): string {
  if (winner === 'meta') return metaLabel;
  if (winner === 'google') return googleLabel;
  if (winner === 'tie') return 'Empate';
  return '—';
}

function CompareRow({
  label,
  metaValue,
  googleValue,
  winner,
  metaSub,
  googleSub,
}: {
  label: string;
  metaValue: string;
  googleValue: string;
  winner: ChannelMetricWinner;
  metaSub?: string;
  googleSub?: string;
}) {
  return (
    <tr className="border-b border-bg-border last:border-0">
      <td className="py-3 pr-4 text-sm font-medium text-fg-muted">{label}</td>
      <td
        className={cn(
          'py-3 px-3 text-right text-sm tabular-nums',
          winner === 'meta' && 'rounded-lg bg-sky-50 font-semibold text-sky-800',
        )}
      >
        <div>{metaValue}</div>
        {metaSub ? <div className="text-[11px] font-normal text-fg-tertiary">{metaSub}</div> : null}
        {winner === 'meta' ? (
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-sky-600">
            <Crown className="h-3 w-3" />
            Mejor
          </span>
        ) : null}
      </td>
      <td
        className={cn(
          'py-3 pl-3 text-right text-sm tabular-nums',
          winner === 'google' && 'rounded-lg bg-emerald-50 font-semibold text-emerald-800',
        )}
      >
        <div>{googleValue}</div>
        {googleSub ? (
          <div className="text-[11px] font-normal text-fg-tertiary">{googleSub}</div>
        ) : null}
        {winner === 'google' ? (
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-600">
            <Crown className="h-3 w-3" />
            Mejor
          </span>
        ) : null}
      </td>
    </tr>
  );
}

export function ChannelCompareCard() {
  const [data, setData] = useState<ChannelCompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/ads/channel-compare')
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | ChannelCompareResponse
          | { error?: unknown };
        if (!res.ok) {
          throw new Error(parseFetchError(body, res.status));
        }
        return body as ChannelCompareResponse;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !data) {
    return (
      <KpiVividPanel title="Canal vs Canal" subtitle="Cargando…" accent="violet">
        <KpiEmptyState description="Comparando Meta Ads y Google Ads…" />
      </KpiVividPanel>
    );
  }

  if (error && !data) {
    return <KpiSectionError title="Canal vs Canal" error={error} />;
  }

  if (!data) {
    return (
      <KpiVividPanel title="Canal vs Canal" accent="violet">
        <KpiEmptyState description="Sin datos de comparación" />
      </KpiVividPanel>
    );
  }

  const hasAnyChannel = data.meta.available || data.google.available;

  return (
    <KpiVividPanel
      title="Canal vs Canal"
      subtitle="Meta Ads vs Google Ads · últimos 30 días"
      accent="violet"
    >
      {!hasAnyChannel ? (
        <KpiEmptyState description="Ningún canal de ads disponible. Configura Meta o Google Ads." />
      ) : (
        <>
          {(data.meta.error || data.google.error) && (
            <div className="mb-4 space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {data.meta.error ? <p>Meta: {data.meta.error}</p> : null}
              {data.google.error ? <p>Google: {data.google.error}</p> : null}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-bg-border text-left text-xs uppercase tracking-wide text-fg-muted">
                  <th className="pb-2 pr-4 font-semibold">Métrica</th>
                  <th className="pb-2 px-3 text-right font-semibold">
                    <span className="inline-flex items-center justify-end gap-1 text-sky-700">
                      <Megaphone className="h-3.5 w-3.5" />
                      Meta Ads
                    </span>
                  </th>
                  <th className="pb-2 pl-3 text-right font-semibold">
                    <span className="inline-flex items-center justify-end gap-1 text-emerald-700">
                      <Megaphone className="h-3.5 w-3.5" />
                      Google Ads
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <CompareRow
                  label="Gasto"
                  metaValue={
                    data.meta.available ? `${fmtUsd(data.meta.spend_usd)} USD` : '—'
                  }
                  googleValue={
                    data.google.available ? `${fmtUsd(data.google.spend_usd)} USD` : '—'
                  }
                  metaSub={
                    data.meta.available ? fmtNative(data.meta.spend, 'MXN') : undefined
                  }
                  googleSub={
                    data.google.available ? fmtNative(data.google.spend, 'COP') : undefined
                  }
                  winner={data.winners.spend}
                />
                <CompareRow
                  label="Conversiones"
                  metaValue={
                    data.meta.available
                      ? data.meta.conversions.toLocaleString('es-MX')
                      : '—'
                  }
                  googleValue={
                    data.google.available
                      ? data.google.conversions.toLocaleString('es-MX')
                      : '—'
                  }
                  metaSub={data.meta.available ? 'Conversaciones WA' : undefined}
                  googleSub={data.google.available ? 'Registros' : undefined}
                  winner={data.winners.conversions}
                />
                <CompareRow
                  label="Clicks"
                  metaValue={
                    data.meta.available ? data.meta.clicks.toLocaleString('es-MX') : '—'
                  }
                  googleValue={
                    data.google.available ? data.google.clicks.toLocaleString('es-MX') : '—'
                  }
                  winner={null}
                />
                <CompareRow
                  label="CPA"
                  metaValue={
                    data.meta.available && data.meta.cpa_usd != null
                      ? `${fmtUsd(data.meta.cpa_usd)} USD`
                      : '—'
                  }
                  googleValue={
                    data.google.available && data.google.cpa_usd != null
                      ? `${fmtUsd(data.google.cpa_usd)} USD`
                      : '—'
                  }
                  metaSub={
                    data.meta.available && data.meta.cpa != null
                      ? fmtNative(data.meta.cpa, 'MXN')
                      : undefined
                  }
                  googleSub={
                    data.google.available && data.google.cpa != null
                      ? fmtNative(data.google.cpa, 'COP')
                      : undefined
                  }
                  winner={data.winners.cpa}
                />
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-fg-muted">
            <span className="inline-flex items-center gap-1">
              <Target className="h-3.5 w-3.5" />
              CPA: {winnerLabel(data.winners.cpa, 'Meta gana', 'Google gana')}
            </span>
            <span className="inline-flex items-center gap-1">
              <MousePointerClick className="h-3.5 w-3.5" />
              Conversiones:{' '}
              {winnerLabel(data.winners.conversions, 'Meta gana', 'Google gana')}
            </span>
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-fg-muted">
        FX {data.fx.mxn_per_usd.toFixed(2)} MXN/USD · {data.fx.cop_per_usd.toFixed(0)} COP/USD ·
        Actualizado {new Date(data.updated_at).toLocaleString('es-MX')}
      </p>
    </KpiVividPanel>
  );
}
