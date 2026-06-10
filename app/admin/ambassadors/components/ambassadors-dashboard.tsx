'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AmbassadorMetrics, AmbassadorRow } from '@/lib/ambassador-admin-queries';
import { AmbassadorMetrics as MetricsCards } from './AmbassadorMetrics';
import { AmbassadorTable } from './AmbassadorTable';
import { cn } from '@/lib/cn';

type Filter = 'all' | 'registered' | 'unregistered';

const FILTER_CHIPS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'registered', label: 'Registrados' },
  { id: 'unregistered', label: 'Sin registrar' },
];

export function AmbassadorsDashboard() {
  const [filter, setFilter] = useState<Filter>('all');
  const [rows, setRows] = useState<AmbassadorRow[]>([]);
  const [metrics, setMetrics] = useState<AmbassadorMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ambassadors?filter=${filter}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { rows: AmbassadorRow[]; metrics: AmbassadorMetrics };
      setRows(data.rows);
      setMetrics(data.metrics);
    } catch (error) {
      console.error('[ambassadors-dashboard] load failed', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const markAttended = useCallback(
    async (id: string, attended: boolean) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/admin/ambassadors/${id}/webinar-attended`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attended }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await load();
      } catch (error) {
        console.error('[ambassadors-dashboard] mark attended failed', error);
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  return (
    <div className="space-y-6">
      <MetricsCards metrics={metrics} />

      <div className="flex flex-wrap gap-2">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setFilter(chip.id)}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              filter === chip.id
                ? 'bg-accent text-white'
                : 'bg-bg-subtle text-fg-muted hover:text-fg',
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-fg-muted">Cargando embajadores…</p>
      ) : (
        <AmbassadorTable rows={rows} onMarkAttended={markAttended} busyId={busyId} />
      )}
    </div>
  );
}
