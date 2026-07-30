'use client';

import { useEffect, useState } from 'react';
import { DollarSign, MessageCircle, MousePointerClick, Percent, Target } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { MetaAdsSummary } from '@/lib/meta-ads-summary';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiVividMetric } from '@/components/admin/kpis/vivid/kpi-vivid-metric';
import { KpiVividPanel } from '@/components/admin/kpis/vivid/kpi-vivid-panel';
import { KpiVividTable } from '@/components/admin/kpis/vivid/kpi-vivid-table';

function fmtMxn(value: number | null | undefined): string {
  if (value == null) return '—';
  return `$${value.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} MXN`;
}

function statusBadge(status: string) {
  const active = status === 'ACTIVE';
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
      )}
    >
      {active ? 'Activa' : status.toLowerCase()}
    </span>
  );
}

function MetaGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M23.5 0C20.2 0 17.7 1.7 16 4.6 14.5 1.9 12.1 0 8.9 0 3.9 0 0 4.5 0 10.7 0 18.5 5.4 24 12.1 24c2.7 0 5.1-1 7.1-2.8L22 18c-1.4 1.4-3.1 2.2-5.1 2.2-4.3 0-7.7-3.8-7.7-9.5C9.2 5.6 11.8 3 14.8 3c2.2 0 3.8 1.2 4.8 3.5L21.5 12l1.9-5.5C24.4 4.2 26 3 28.1 3c3 0 5.6 2.6 5.6 7.7 0 5.7-3.4 9.5-7.7 9.5-2 0-3.7-.8-5.1-2.2l-2.8 2.8c2 1.8 4.4 2.8 7.1 2.8C30.6 24 36 18.5 36 10.7 36 4.5 32.1 0 27.1 0h-3.6z"
      />
    </svg>
  );
}

export function MetaAdsCard() {
  const [data, setData] = useState<MetaAdsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/meta-ads/summary')
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<MetaAdsSummary>;
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

  const headerAction = (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
      <MetaGlyph className="h-3 w-3" />
      act · 30d
    </span>
  );

  if (loading && !data) {
    return (
      <KpiVividPanel title="Meta Ads" subtitle="Cargando…" accent="sky" action={headerAction}>
        <KpiEmptyState description="Cargando campañas de Meta Ads…" />
      </KpiVividPanel>
    );
  }

  if (error && !data) {
    return <KpiSectionError title="Meta Ads" error={error} />;
  }

  if (!data) {
    return (
      <KpiVividPanel title="Meta Ads" accent="sky" action={headerAction}>
        <KpiEmptyState description="Sin datos de Meta Ads" />
      </KpiVividPanel>
    );
  }

  const activeCampaigns = data.campaigns.filter((c) => c.effective_status === 'ACTIVE');
  const tableRows = (activeCampaigns.length > 0 ? activeCampaigns : data.campaigns).slice(0, 12);

  return (
    <KpiVividPanel
      title="Meta Ads"
      subtitle="Gasto, CTR, conversaciones y CPA · últimos 30 días"
      accent="sky"
      action={headerAction}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiVividMetric
          label="Gasto"
          value={fmtMxn(data.totals.spend)}
          icon={DollarSign}
          accent="amber"
          compact
          hint="30d"
        />
        <KpiVividMetric
          label="Impresiones"
          value={data.totals.impressions.toLocaleString('es-MX')}
          icon={Target}
          accent="violet"
          compact
          hint="30d"
        />
        <KpiVividMetric
          label="CTR"
          value={`${data.totals.ctr.toFixed(2)}%`}
          icon={Percent}
          accent="emerald"
          compact
          hint="30d"
        />
        <KpiVividMetric
          label="CPA"
          value={data.totals.cpa != null ? fmtMxn(data.totals.cpa) : '—'}
          icon={MessageCircle}
          accent="sky"
          compact
          hint="por conversación"
        />
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold text-fg-muted">
          {activeCampaigns.length > 0 ? 'Campañas activas' : 'Campañas (30d)'} · {tableRows.length}
        </p>
        {tableRows.length > 0 ? (
          <KpiVividTable
            rows={tableRows}
            rowKey={(row) => row.campaign_id}
            columns={[
              {
                key: 'name',
                header: 'Campaña',
                render: (row) => (
                  <span className="block max-w-[200px] truncate font-medium">{row.campaign_name}</span>
                ),
              },
              {
                key: 'status',
                header: 'Estado',
                render: (row) => statusBadge(row.effective_status),
              },
              {
                key: 'spend',
                header: 'Gasto',
                render: (row) => (
                  <span className="tabular-nums text-amber-700">{fmtMxn(row.spend)}</span>
                ),
              },
              {
                key: 'clicks',
                header: 'Clicks',
                render: (row) => (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <MousePointerClick className="h-3 w-3 text-fg-muted" />
                    {row.clicks.toLocaleString('es-MX')}
                  </span>
                ),
              },
              {
                key: 'conversations',
                header: 'Conversaciones',
                render: (row) => (
                  <span className="tabular-nums">{row.conversations.toLocaleString('es-MX')}</span>
                ),
              },
              {
                key: 'cpa',
                header: 'CPA',
                render: (row) => (
                  <span className="tabular-nums">{row.cpa != null ? fmtMxn(row.cpa) : '—'}</span>
                ),
              },
            ]}
          />
        ) : (
          <KpiEmptyState description="No hay campañas en el periodo." />
        )}
      </div>

      <p className="mt-4 text-xs text-fg-muted">
        Meta Marketing API · Actualizado {new Date(data.updated_at).toLocaleString('es-MX')} · caché 4h
      </p>
    </KpiVividPanel>
  );
}
