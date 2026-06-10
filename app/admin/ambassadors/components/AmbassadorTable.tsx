'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AmbassadorRow } from '@/lib/ambassador-admin-queries';
import { Button } from '@/components/ui/button';

type Props = {
  rows: AmbassadorRow[];
  onMarkAttended: (id: string, attended: boolean) => Promise<void>;
  busyId: string | null;
};

function webinarStatus(row: AmbassadorRow): string {
  if (row.webinar_attended) return '✅ Asistió';
  if (row.webinar_registered) return '✅ Registrado';
  if (row.webinar_link_sent_at) return '📩 Link enviado';
  return '❌ Sin registrar';
}

export function AmbassadorTable({ rows, onMarkAttended, busyId }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-bg-border px-4 py-8 text-center text-sm text-fg-muted">
        No hay embajadores con este filtro.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-bg-border">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-bg-border bg-bg-subtle text-xs uppercase tracking-wide text-fg-muted">
          <tr>
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Teléfono</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Webinar</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Último msg</th>
            <th className="px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const lastMsg = row.last_msg_at
              ? format(new Date(row.last_msg_at), 'd MMM HH:mm', { locale: es })
              : '—';
            const isActive =
              row.last_msg_at &&
              Date.now() - new Date(row.last_msg_at).getTime() < 7 * 24 * 3600 * 1000;

            return (
              <tr key={row.id} className="border-b border-bg-border last:border-0">
                <td className="px-4 py-3 font-medium">{row.name ?? '—'}</td>
                <td className="px-4 py-3 text-fg-muted">{row.customer_phone}</td>
                <td className="px-4 py-3 text-fg-muted">{row.email ?? '—'}</td>
                <td className="px-4 py-3">{webinarStatus(row)}</td>
                <td className="px-4 py-3">
                  {isActive ? (
                    <span className="text-semantic-warm">Activo</span>
                  ) : (
                    <span className="text-fg-muted">Sin respuesta</span>
                  )}
                </td>
                <td className="px-4 py-3 text-fg-muted">{lastMsg}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/conversations/${row.id}`}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Ver conversación
                    </Link>
                    {!row.webinar_attended ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busyId === row.id}
                        onClick={() => void onMarkAttended(row.id, true)}
                      >
                        Marcar asistió
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
