'use client';

import { useEffect, useState } from 'react';
import { DollarSign, MessageCircle, MousePointerClick, Percent, Settings, Target } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { GoogleAdsSummary } from '@/lib/google-ads-summary';
import { KpiEmptyState } from '@/components/admin/kpis/kpi-empty-state';
import { KpiSectionError } from '@/components/admin/kpis/kpi-section-error';
import { KpiVividMetric } from '@/components/admin/kpis/vivid/kpi-vivid-metric';
import { KpiVividPanel } from '@/components/admin/kpis/vivid/kpi-vivid-panel';
import { KpiVividTable } from '@/components/admin/kpis/vivid/kpi-vivid-table';

function fmtCop(value: number | null | undefined): string {
  if (value == null) return '—';
  return `$${value.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP`;
}

function fmtCopCpa(value: number | null | undefined): string {
  if (value == null) return '—';
  return `$${Number(value).toFixed(2)} COP`;
}

function statusBadge(status: string) {
  const active = status === 'ENABLED';
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

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
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

export function GoogleAdsCard() {
  const [data, setData] = useState<GoogleAdsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/google-ads/summary')
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as GoogleAdsSummary | { error?: unknown };
        if (!res.ok) {
          throw new Error(parseFetchError(body, res.status));
        }
        return body as GoogleAdsSummary;
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
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
      <GoogleGlyph className="h-3 w-3" />
      act · 30d
    </span>
  );

  if (loading && !data) {
    return (
      <KpiVividPanel title="Google Ads" subtitle="Cargando…" accent="emerald" action={headerAction}>
        <KpiEmptyState description="Cargando campañas de Google Ads…" />
      </KpiVividPanel>
    );
  }

  if (error && !data) {
    return <KpiSectionError title="Google Ads" error={error} />;
  }

  if (!data) {
    return (
      <KpiVividPanel title="Google Ads" accent="emerald" action={headerAction}>
        <KpiEmptyState description="Sin datos de Google Ads" />
      </KpiVividPanel>
    );
  }

  if (!data.configured) {
    return (
      <KpiVividPanel title="Google Ads" accent="emerald" action={headerAction}>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Settings className="h-8 w-8 text-fg-muted" />
          <p className="text-sm font-medium text-fg">Configura Google Ads en Vercel</p>
          <p className="max-w-sm text-xs text-fg-muted">
            Preferido:{' '}
            <code className="rounded bg-bg-muted px-1">GOOGLE_ADS_DEVELOPER_TOKEN</code> + OAuth (
            <code className="rounded bg-bg-muted px-1">GOOGLE_ADS_CLIENT_ID</code>,{' '}
            <code className="rounded bg-bg-muted px-1">CLIENT_SECRET</code>,{' '}
            <code className="rounded bg-bg-muted px-1">REFRESH_TOKEN</code>,{' '}
            <code className="rounded bg-bg-muted px-1">GOOGLE_ADS_CUSTOMER_ID</code>). Fallback
            opcional con Composio REST: Project key{' '}
            <code className="rounded bg-bg-muted px-1">ak_*</code> (no MCP{' '}
            <code className="rounded bg-bg-muted px-1">ck_*</code>),{' '}
            <code className="rounded bg-bg-muted px-1">GOOGLE_ADS_COMPOSIO_FALLBACK=true</code>.
          </p>
        </div>
      </KpiVividPanel>
    );
  }

  const activeCampaigns = data.campaigns.filter((c) => c.status === 'ENABLED');
  const tableRows = (activeCampaigns.length > 0 ? activeCampaigns : data.campaigns).slice(0, 12);

  return (
    <KpiVividPanel
      title="Google Ads"
      subtitle="Gasto, CTR, conversiones y CPA · últimos 30 días"
      accent="emerald"
      action={headerAction}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiVividMetric
          label="Gasto"
          value={fmtCop(data.totals.spend)}
          icon={DollarSign}
          accent="amber"
          compact
          hint="30d"
        />
        <KpiVividMetric
          label="Impresiones"
          value={data.totals.impressions.toLocaleString('es-CO')}
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
          value={data.totals.cpa != null ? fmtCopCpa(data.totals.cpa) : '—'}
          icon={MessageCircle}
          accent="sky"
          compact
          hint="por conversión"
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
                render: (row) => statusBadge(row.status),
              },
              {
                key: 'spend',
                header: 'Gasto',
                render: (row) => (
                  <span className="tabular-nums text-amber-700">{fmtCop(row.spend)}</span>
                ),
              },
              {
                key: 'clicks',
                header: 'Clicks',
                render: (row) => (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <MousePointerClick className="h-3 w-3 text-fg-muted" />
                    {row.clicks.toLocaleString('es-CO')}
                  </span>
                ),
              },
              {
                key: 'conversions',
                header: 'Conversiones',
                render: (row) => (
                  <span className="tabular-nums">{row.conversions.toLocaleString('es-CO')}</span>
                ),
              },
              {
                key: 'cpa',
                header: 'CPA',
                render: (row) => (
                  <span className="tabular-nums">{row.cpa != null ? fmtCopCpa(row.cpa) : '—'}</span>
                ),
              },
            ]}
          />
        ) : (
          <KpiEmptyState description="No hay campañas en el periodo." />
        )}
      </div>

      <p className="mt-4 text-xs text-fg-muted">
        Google Ads API · Actualizado {new Date(data.updated_at).toLocaleString('es-CO')} · caché 4h
        {data.warning ? (
          <span className="mt-1 block text-amber-700">{data.warning}</span>
        ) : null}
      </p>
    </KpiVividPanel>
  );
}
