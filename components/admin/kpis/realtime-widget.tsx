'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Globe, MonitorSmartphone } from 'lucide-react';
import { cn } from '@/lib/cn';
import { KpiVividPanel } from './vivid/kpi-vivid-panel';

type PropertyRealtime = {
  total: number;
  pages: Array<{ page: string; users: number }>;
};

type RealtimePayload = {
  landing: PropertyRealtime;
  app: PropertyRealtime;
  updated_at: string;
};

const REFRESH_MS = 30_000;

const ACCENTS = {
  landing: { icon: 'text-emerald-600', bar: 'bg-emerald-500', bg: 'bg-emerald-50' },
  app: { icon: 'text-violet-600', bar: 'bg-violet-500', bg: 'bg-violet-50' },
};

function PropertyColumn({
  domain,
  icon: Icon,
  variant,
  data,
  unavailable,
}: {
  domain: string;
  icon: typeof Globe;
  variant: keyof typeof ACCENTS;
  data: PropertyRealtime | null;
  unavailable: boolean;
}) {
  const a = ACCENTS[variant];

  if (unavailable) {
    return (
      <div className="min-w-0 flex-1 rounded-xl border border-bg-border bg-bg-subtle/50 p-4">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', a.icon)} />
          <p className="text-sm font-semibold text-fg">{domain}</p>
        </div>
        <p className="mt-3 text-sm text-fg-muted">No disponible</p>
      </div>
    );
  }

  const total = data?.total ?? 0;
  const pages = data?.pages ?? [];
  const maxUsers = Math.max(...pages.map((p) => p.users), 1);

  return (
    <div className={cn('min-w-0 flex-1 rounded-xl border border-bg-border p-4', a.bg)}>
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', a.icon)} />
        <p className="text-sm font-semibold text-fg">{domain}</p>
      </div>
      {total === 0 ? (
        <p className="mt-4 text-sm text-fg-muted">Sin actividad en este momento</p>
      ) : (
        <>
          <p className="mt-3 text-3xl font-bold tabular-nums text-fg">
            {total}
            <span className="ml-2 text-sm font-normal text-fg-muted">usuarios ahora</span>
          </p>
          {pages.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {pages.map((row) => (
                <li key={row.page}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-fg-muted" title={row.page}>
                      {row.page}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-fg">{row.users}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/60">
                    <div
                      className={cn('h-full rounded-full', a.bar)}
                      style={{ width: `${(row.users / maxUsers) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}

type Props = {
  enabled?: boolean;
};

export function RealtimeWidget({ enabled = true }: Props) {
  const [data, setData] = useState<RealtimePayload | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const fetchRealtime = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch('/api/kpis/realtime', { cache: 'no-store' });
      if (!res.ok) {
        setError(true);
        setData(null);
        return;
      }
      const payload = (await res.json()) as RealtimePayload;
      setData(payload);
      setError(false);
      setUpdatedAt(Date.now());
      setSecondsAgo(0);
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void fetchRealtime();
    const refreshId = window.setInterval(() => void fetchRealtime(), REFRESH_MS);
    return () => window.clearInterval(refreshId);
  }, [fetchRealtime, enabled]);

  useEffect(() => {
    if (!updatedAt) return;
    const tickId = window.setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - updatedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(tickId);
  }, [updatedAt]);

  const totalLive = (data?.landing.total ?? 0) + (data?.app.total ?? 0);

  return (
    <KpiVividPanel
      title="En vivo"
      subtitle="GA4 Realtime · actualización cada 30s"
      accent="sky"
      action={
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              !enabled || error ? 'bg-fg-tertiary' : 'animate-pulse bg-emerald-500',
            )}
          />
          <span className="text-xs font-semibold text-fg-muted">
            {enabled ? (error ? 'Offline' : 'Live') : 'Pausado'}
          </span>
        </div>
      }
    >
      {!enabled ? (
        <p className="text-sm text-fg-muted">Stream en vivo pausado.</p>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3 rounded-xl bg-sky-50 px-3 py-2">
            <Activity className="h-4 w-4 text-sky-600" />
            <span className="text-sm text-fg">
              Tráfico activo total:{' '}
              <strong className="tabular-nums text-sky-700">{totalLive}</strong> usuarios
            </span>
            {loading && !data && !error ? (
              <span className="text-xs text-fg-muted">cargando…</span>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <PropertyColumn
              domain="kalyo.io"
              icon={Globe}
              variant="landing"
              data={error ? null : data?.landing ?? null}
              unavailable={error}
            />
            <PropertyColumn
              domain="app.kalyo.io"
              icon={MonitorSmartphone}
              variant="app"
              data={error ? null : data?.app ?? null}
              unavailable={error}
            />
          </div>

          <p className="mt-4 text-xs text-fg-muted">
            {error
              ? 'Señal no disponible'
              : updatedAt
                ? `Actualizado hace ${secondsAgo}s · ${new Date(updatedAt).toLocaleTimeString('es-MX')}`
                : 'Sincronizando…'}
          </p>
        </>
      )}
    </KpiVividPanel>
  );
}
