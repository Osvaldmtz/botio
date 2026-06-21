'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

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
  data,
  unavailable,
}: {
  domain: string;
  data: PropertyRealtime | null;
  unavailable: boolean;
}) {
  if (unavailable) {
    return (
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-fg">{domain}</p>
        <p className="mt-3 text-sm text-fg-muted">No disponible</p>
      </div>
    );
  }

  const total = data?.total ?? 0;
  const pages = data?.pages ?? [];

  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-fg">{domain}</p>
      {total === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">Sin actividad en este momento</p>
      ) : (
        <>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-fg">
            {total}{' '}
            <span className="text-base font-normal text-fg-muted">
              {total === 1 ? 'usuario ahora' : 'usuarios ahora'}
            </span>
          </p>
          {pages.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {pages.map((row) => (
                <li
                  key={row.page}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate text-fg-muted" title={row.page}>
                    {row.page}
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-fg">
                    {row.users}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}

export function RealtimeWidget() {
  const [data, setData] = useState<RealtimePayload | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const fetchRealtime = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void fetchRealtime();
    const refreshId = window.setInterval(() => void fetchRealtime(), REFRESH_MS);
    return () => window.clearInterval(refreshId);
  }, [fetchRealtime]);

  useEffect(() => {
    if (!updatedAt) return;
    const tickId = window.setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - updatedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(tickId);
  }, [updatedAt]);

  return (
    <section className="rounded-card border border-bg-border bg-bg p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-75',
              error ? 'bg-fg-tertiary' : 'animate-ping bg-accent',
            )}
          />
          <span
            className={cn(
              'relative inline-flex h-2.5 w-2.5 rounded-full',
              error ? 'bg-fg-tertiary' : 'bg-accent',
            )}
          />
        </span>
        <h2 className="text-sm font-semibold text-fg">En vivo</h2>
        {loading && !data && !error ? (
          <span className="text-xs text-fg-muted">Cargando…</span>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <PropertyColumn
          domain="kalyo.io"
          data={error ? null : data?.landing ?? null}
          unavailable={error}
        />
        <PropertyColumn
          domain="app.kalyo.io"
          data={error ? null : data?.app ?? null}
          unavailable={error}
        />
      </div>

      <p className="mt-4 text-xs text-fg-tertiary">
        {error
          ? 'No disponible'
          : updatedAt
            ? `Actualizado hace ${secondsAgo} seg`
            : 'Actualizando…'}
      </p>
    </section>
  );
}
