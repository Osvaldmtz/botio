import 'server-only';
import Link from 'next/link';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { AdminShell } from '@/components/admin/admin-shell';
import { getCalendarConnectionStatus } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function CalendarSettingsPage({ searchParams }: Props) {
  if (!isAdmin()) return <LoginForm />;

  const status = await getCalendarConnectionStatus();
  const connected = searchParams.connected === '1' || status.connected;
  const error =
    typeof searchParams.error === 'string' ? decodeURIComponent(searchParams.error) : null;

  return (
    <AdminShell
      title="Google Calendar"
      subtitle="Conecta el calendario de Osvaldo para que Sofía agende demos automáticamente."
    >
      <div className="max-w-lg rounded-lg border border-bg-border bg-bg-subtle p-6">
        {error ? (
          <p className="mb-4 rounded-md bg-semantic-hot/10 px-3 py-2 text-sm text-semantic-hot">
            Error al conectar: {error}
          </p>
        ) : null}

        {connected ? (
          <div className="space-y-4">
            <p className="text-sm text-fg">
              ✅ Conectado como <strong>{status.hostEmail}</strong>
            </p>
            {status.expiresAt ? (
              <p className="text-xs text-fg-muted">
                Token expira: {new Date(status.expiresAt).toLocaleString('es-CO')}
              </p>
            ) : null}
            <Link
              href="/api/admin/google-calendar/connect"
              className="inline-flex rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Reconectar Google Calendar
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-fg-muted">❌ No conectado</p>
            <Link
              href="/api/admin/google-calendar/connect"
              className="inline-flex rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Conectar Google Calendar
            </Link>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
