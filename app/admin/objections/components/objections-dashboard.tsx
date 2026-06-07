'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type Filter =
  | 'all'
  | 'price'
  | 'thinking'
  | 'competition'
  | 'no_time'
  | 'not_useful'
  | 'few_patients';

type ObjectionRow = {
  id: string;
  customer_phone: string;
  customer_email: string | null;
  objection_type: string;
  type_label: string;
  trigger_message: string;
  response_used: string;
  outcome: string | null;
  customer_replied: boolean;
  detected_at: string;
  conversation_id: string | null;
};

type Metrics = {
  total_30d: number;
  conversion_rate_30d: number;
  top_3: Array<{ type: string; label: string; count: number }>;
  conversion_by_type: Record<string, number>;
};

const OUTCOME_LABEL: Record<string, string> = {
  converted: 'Convertido',
  still_objecting: 'Sigue objetando',
  no_response: 'Sin respuesta',
  handoff: 'Handoff',
  pending: 'Pendiente',
  follow_up_sent: 'Follow-up enviado',
};

export function ObjectionsDashboard() {
  const [filter, setFilter] = useState<Filter>('all');
  const [rows, setRows] = useState<ObjectionRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/objections?filter=${filter}`);
      const json = (await res.json()) as { rows?: ObjectionRow[]; metrics?: Metrics };
      setRows(json.rows ?? []);
      setMetrics(json.metrics ?? null);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const tabs: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'price', label: 'Precio' },
    { id: 'thinking', label: 'Pensar' },
    { id: 'competition', label: 'Competencia' },
    { id: 'no_time', label: 'Sin tiempo' },
    { id: 'not_useful', label: 'No sirve' },
    { id: 'few_patients', label: 'Pocos pacientes' },
  ];

  return (
    <div className="space-y-6">
      {metrics ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Objeciones (30d)" value={String(metrics.total_30d)} />
          <MetricCard label="Conversión global (30d)" value={`${metrics.conversion_rate_30d}%`} />
          <MetricCard
            label="Top objeción"
            value={metrics.top_3[0] ? `${metrics.top_3[0].label} (${metrics.top_3[0].count})` : '—'}
          />
          <MetricCard
            label="Top 3"
            value={metrics.top_3.map((t) => t.label).join(', ') || '—'}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === tab.id
                ? 'bg-accent text-white'
                : 'bg-bg-subtle text-fg-muted hover:text-fg'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-fg-muted">Cargando...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-fg-muted">Sin objeciones registradas.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-bg-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-bg-subtle text-xs uppercase text-fg-muted">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-bg-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.customer_email ?? row.customer_phone}</div>
                    <div className="text-xs text-fg-muted">{row.customer_phone}</div>
                  </td>
                  <td className="px-4 py-3">{row.type_label}</td>
                  <td className="max-w-xs truncate px-4 py-3" title={row.trigger_message}>
                    {row.trigger_message}
                  </td>
                  <td className="px-4 py-3">
                    {OUTCOME_LABEL[row.outcome ?? 'pending'] ?? row.outcome ?? 'Pendiente'}
                  </td>
                  <td className="px-4 py-3 text-fg-muted">
                    {format(new Date(row.detected_at), 'd MMM yyyy HH:mm', { locale: es })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-bg-border bg-bg p-4">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-fg">{value}</p>
    </div>
  );
}
