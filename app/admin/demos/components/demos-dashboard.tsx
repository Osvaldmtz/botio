'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type ScheduledDemo = {
  id: string;
  conversation_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  scheduled_at: string;
  duration_minutes: number;
  google_meet_link: string | null;
  status: string;
  created_at: string;
};

type Filter = 'upcoming' | 'past' | 'cancelled';

export function DemosDashboard() {
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [demos, setDemos] = useState<ScheduledDemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/demos?filter=${filter}`);
      const json = (await res.json()) as { demos?: ScheduledDemo[] };
      setDemos(json.demos ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancelDemo(id: string) {
    if (!confirm('¿Cancelar esta demo? Se eliminará el evento de Google Calendar.')) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/admin/demos/${id}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        alert(json.error ?? 'Error al cancelar');
        return;
      }
      await load();
    } finally {
      setCancellingId(null);
    }
  }

  const tabs: { id: Filter; label: string }[] = [
    { id: 'upcoming', label: 'Próximas' },
    { id: 'past', label: 'Pasadas' },
    { id: 'cancelled', label: 'Canceladas' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              filter === tab.id
                ? 'bg-accent text-white'
                : 'border border-bg-border text-fg-muted hover:text-fg'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-fg-muted">Cargando demos…</p>
      ) : demos.length === 0 ? (
        <p className="text-sm text-fg-muted">No hay demos en esta categoría.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-bg-border">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-bg-border bg-bg-subtle text-fg-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha / hora</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Meet</th>
                <th className="px-4 py-3 font-medium">Conversación</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {demos.map((demo) => (
                <tr key={demo.id} className="border-b border-bg-border last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {format(new Date(demo.scheduled_at), "d MMM yyyy HH:mm", { locale: es })}
                  </td>
                  <td className="px-4 py-3">{demo.customer_name}</td>
                  <td className="px-4 py-3">{demo.customer_email}</td>
                  <td className="px-4 py-3">{demo.customer_phone ?? '—'}</td>
                  <td className="px-4 py-3">{demo.status}</td>
                  <td className="px-4 py-3">
                    {demo.google_meet_link ? (
                      <a
                        href={demo.google_meet_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline"
                      >
                        Meet
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {demo.conversation_id ? (
                      <Link
                        href={`/admin/conversations/${demo.conversation_id}`}
                        className="text-accent hover:underline"
                      >
                        Ver chat
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {demo.status === 'scheduled' && filter === 'upcoming' ? (
                      <button
                        type="button"
                        disabled={cancellingId === demo.id}
                        onClick={() => void cancelDemo(demo.id)}
                        className="text-sm text-semantic-hot hover:underline disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    ) : null}
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
