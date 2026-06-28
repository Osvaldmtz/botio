'use client';

import { useCallback, useEffect, useState } from 'react';

type MetricProgress = {
  metric: string;
  current: number;
  threshold: number;
  met: boolean;
};

type ReminderRow = {
  id: string;
  title: string;
  description: string | null;
  trigger_type: string;
  trigger_date: string | null;
  trigger_metric: string | null;
  status: string;
  notified_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  metric_progress: MetricProgress | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  notified: 'Notificado',
  completed: 'Completado',
  dismissed: 'Descartado',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { dateStyle: 'medium', timeZone: 'UTC' });
}

function statusClass(status: string): string {
  if (status === 'completed') return 'text-green-600';
  if (status === 'notified') return 'text-amber-600';
  if (status === 'dismissed') return 'text-fg-muted';
  return 'text-fg';
}

export function RoadmapDashboard() {
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/roadmap');
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { reminders: ReminderRow[] };
      setReminders(data.reminders);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (id: string, action: 'complete' | 'postpone' | 'dismiss') => {
    setActingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/roadmap/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActingId(null);
    }
  };

  function triggerLabel(row: ReminderRow): string {
    const parts: string[] = [];
    if (row.trigger_date && row.trigger_type !== 'metric') {
      parts.push(`Fecha: ${formatDate(row.trigger_date)}`);
    }
    if (row.trigger_metric) {
      const p = row.metric_progress;
      if (p) {
        parts.push(`Métrica: ${p.current}/${p.threshold} (${row.trigger_metric})`);
      } else {
        parts.push(`Métrica: ${row.trigger_metric}`);
      }
    }
    return parts.join(' · ') || '—';
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <p className="text-sm text-fg-muted">
        El cron verifica diariamente a las 9 AM UTC. Cuando se cumple la fecha o la métrica, recibes
        alerta en Telegram.
      </p>

      <div className="overflow-x-auto rounded-lg border border-bg-border bg-bg">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-bg-border text-xs uppercase text-fg-muted">
              <th className="px-4 py-3">Fase</th>
              <th className="px-4 py-3">Descripción</th>
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-fg-muted">
                  Cargando…
                </td>
              </tr>
            ) : reminders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-fg-muted">
                  Sin recordatorios.
                </td>
              </tr>
            ) : (
              reminders.map((row) => (
                <tr key={row.id} className="border-b border-bg-border/60 align-top">
                  <td className="px-4 py-3 font-medium text-fg">{row.title}</td>
                  <td className="max-w-xs px-4 py-3 text-fg-muted">{row.description}</td>
                  <td className="px-4 py-3 text-fg-muted">{triggerLabel(row)}</td>
                  <td className={`px-4 py-3 ${statusClass(row.status)}`}>
                    {STATUS_LABELS[row.status] ?? row.status}
                    {row.notified_at ? (
                      <span className="mt-1 block text-xs text-fg-muted">
                        Notificado {formatDate(row.notified_at)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {row.status === 'completed' || row.status === 'dismissed' ? (
                      <span className="text-xs text-fg-muted">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={actingId === row.id}
                          onClick={() => void runAction(row.id, 'complete')}
                          className="rounded border border-green-600 px-2 py-1 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
                        >
                          Completado
                        </button>
                        <button
                          type="button"
                          disabled={actingId === row.id}
                          onClick={() => void runAction(row.id, 'postpone')}
                          className="rounded border border-bg-border px-2 py-1 text-xs text-fg hover:bg-bg-subtle disabled:opacity-50"
                        >
                          Posponer 30d
                        </button>
                        <button
                          type="button"
                          disabled={actingId === row.id}
                          onClick={() => void runAction(row.id, 'dismiss')}
                          className="rounded border border-bg-border px-2 py-1 text-xs text-fg-muted hover:bg-bg-subtle disabled:opacity-50"
                        >
                          Descartar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
