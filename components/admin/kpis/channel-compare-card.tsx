'use client';

import { useEffect, useState } from 'react';
import { Crown, Megaphone, MousePointerClick, Target } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ChannelCompareResponse } from '@/lib/ads-channel-compare-types';
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

function ChannelColumn({
  title,
  accent,
  winner,
  spend,
  spendNative,
  currency,
  clicks,
  conversions,
  conversionLabel,
  cpaUsd,
  cpaNative,
}: {
  title: string;
  accent: 'sky' | 'emerald';
  winner: boolean;
  spend: number;
  spendNative: number;
  currency: 'MXN' | 'COP';
  clicks: number;
  conversions: number;
  conversionLabel: string;
  cpaUsd: number | null;
  cpaNative: number | null;
}) {
  return (
    <div
      className={cn(
        'relative rounded-2xl border p-4 transition',
        winner
          ? accent === 'sky'
            ? 'border-sky-400 bg-sky-50/80 shadow-sm ring-2 ring-sky-200'
            : 'border-emerald-400 bg-emerald-50/80 shadow-sm ring-2 ring-emerald-200'
          : 'border-bg-border bg-bg/40',
      )}
    >
      {winner ? (
        <span
          className={cn(
            'absolute -top-2.5 right-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white',
            accent === 'sky' ? 'bg-sky-600' : 'bg-emerald-600',
          )}
        >
          <Crown className="h-3 w-3" />
          Mejor CPA
        </span>
      ) : null}

      <div className="mb-3 flex items-center gap-2">
        <Megaphone
          className={cn('h-4 w-4', accent === 'sky' ? 'text-sky-600' : 'text-emerald-600')}
        />
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
      </div>

      <dl className="space-y-2.5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-fg-muted">Gasto</dt>
          <dd className="text-right">
            <div className="font-semibold tabular-nums text-fg">{fmtUsd(spend)} USD</div>
            <div className="text-[11px] tabular-nums text-fg-tertiary">
              {fmtNative(spendNative, currency)}
            </div>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="inline-flex items-center gap-1 text-fg-muted">
            <MousePointerClick className="h-3.5 w-3.5" />
            Clicks
          </dt>
          <dd className="font-semibold tabular-nums">{clicks.toLocaleString('es-MX')}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="inline-flex items-center gap-1 text-fg-muted">
            <Target className="h-3.5 w-3.5" />
            {conversionLabel}
          </dt>
          <dd className="font-semibold tabular-nums">{conversions.toLocaleString('es-MX')}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-bg-border pt-2.5">
          <dt className="text-fg-muted">CPA</dt>
          <dd className="text-right">
            <div
              className={cn(
                'text-base font-bold tabular-nums',
                winner ? (accent === 'sky' ? 'text-sky-700' : 'text-emerald-700') : 'text-fg',
              )}
            >
              {cpaUsd != null ? `${fmtUsd(cpaUsd)} USD` : '—'}
            </div>
            <div className="text-[11px] tabular-nums text-fg-tertiary">
              {cpaNative != null ? fmtNative(cpaNative, currency) : 'sin conversiones'}
            </div>
          </dd>
        </div>
      </dl>
    </div>
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
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<ChannelCompareResponse>;
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

  return (
    <KpiVividPanel
      title="Canal vs Canal"
      subtitle="Meta Ads vs Google Ads · CPA en USD (últimos 30 días)"
      accent="violet"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <ChannelColumn
          title="Meta Ads"
          accent="sky"
          winner={data.winner === 'meta'}
          spend={data.meta.spend_usd}
          spendNative={data.meta.spend}
          currency="MXN"
          clicks={data.meta.clicks}
          conversions={data.meta.conversions}
          conversionLabel="Conversaciones"
          cpaUsd={data.meta.cpa_usd}
          cpaNative={data.meta.cpa}
        />
        <ChannelColumn
          title="Google Ads"
          accent="emerald"
          winner={data.winner === 'google'}
          spend={data.google.spend_usd}
          spendNative={data.google.spend}
          currency="COP"
          clicks={data.google.clicks}
          conversions={data.google.conversions}
          conversionLabel="Registros"
          cpaUsd={data.google.cpa_usd}
          cpaNative={data.google.cpa}
        />
      </div>

      {data.winner === 'tie' ? (
        <p className="mt-3 text-center text-xs font-medium text-fg-muted">
          Empate en CPA (USD) entre ambos canales.
        </p>
      ) : null}

      <p className="mt-4 text-xs text-fg-muted">
        FX {data.fx.mxn_per_usd.toFixed(2)} MXN/USD · {data.fx.cop_per_usd.toFixed(0)} COP/USD ·
        Actualizado {new Date(data.updated_at).toLocaleString('es-MX')}
      </p>
    </KpiVividPanel>
  );
}
