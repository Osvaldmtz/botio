'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Globe, MonitorSmartphone } from 'lucide-react';
import { cn } from '@/lib/cn';
import { KpiJarvisPanel } from './jarvis/kpi-jarvis-theme';

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

function PropertyColumn({
  domain,
  icon: Icon,
  accent,
  data,
  unavailable,
}: {
  domain: string;
  icon: typeof Globe;
  accent: string;
  data: PropertyRealtime | null;
  unavailable: boolean;
}) {
  if (unavailable) {
    return (
      <div className="min-w-0 flex-1 rounded-lg border border-white/5 bg-slate-950/40 p-4">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', accent)} />
          <p className="text-sm font-medium text-slate-200">{domain}</p>
        </div>
        <p className="mt-3 text-sm text-slate-500">No disponible</p>
      </div>
    );
  }

  const total = data?.total ?? 0;
  const pages = data?.pages ?? [];
  const maxUsers = Math.max(...pages.map((p) => p.users), 1);

  return (
    <div className="min-w-0 flex-1 rounded-lg border border-white/5 bg-slate-950/40 p-4">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', accent)} />
        <p className="text-sm font-medium text-slate-200">{domain}</p>
      </div>
      {total === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Sin actividad en este momento</p>
      ) : (
        <>
          <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-white">
            {total}
            <span className="ml-2 text-sm font-normal text-slate-400">usuarios ahora</span>
          </p>
          {pages.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {pages.map((row) => (
                <li key={row.page}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-400" title={row.page}>
                      {row.page}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-slate-200">
                      {row.users}
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={cn('h-full rounded-full', accent.replace('text-', 'bg-'))}
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
    <KpiJarvisPanel
      title="Pulse · En vivo"
      subtitle="GA4 Realtime · actualización cada 30s"
      accent="cyan"
      action={
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75',
                !enabled || error ? 'bg-slate-500' : 'animate-ping bg-emerald-400',
              )}
            />
            <span
              className={cn(
                'relative inline-flex h-2.5 w-2.5 rounded-full',
                !enabled || error ? 'bg-slate-500' : 'bg-emerald-400',
              )}
            />
          </span>
          <span className="font-mono text-xs text-emerald-300">
            {enabled ? (error ? 'OFFLINE' : 'LIVE') : 'PAUSED'}
          </span>
        </div>
      }
    >
      {!enabled ? (
        <p className="text-sm text-slate-500">Stream en vivo pausado desde controles.</p>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <span className="text-sm text-slate-300">
              Tráfico activo total:{' '}
              <span className="font-mono font-semibold text-cyan-200">{totalLive}</span> usuarios
            </span>
            {loading && !data && !error ? (
              <span className="text-xs text-slate-500">escaneando…</span>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <PropertyColumn
              domain="kalyo.io"
              icon={Globe}
              accent="text-orange-400"
              data={error ? null : data?.landing ?? null}
              unavailable={error}
            />
            <PropertyColumn
              domain="app.kalyo.io"
              icon={MonitorSmartphone}
              accent="text-violet-400"
              data={error ? null : data?.app ?? null}
              unavailable={error}
            />
          </div>

          <p className="mt-4 font-mono text-[11px] text-slate-500">
            {error
              ? '▸ Señal no disponible'
              : updatedAt
                ? `▸ Actualizado hace ${secondsAgo}s · ${new Date(updatedAt).toLocaleTimeString('es-MX')}`
                : '▸ Sincronizando…'}
          </p>
        </>
      )}
    </KpiJarvisPanel>
  );
}
