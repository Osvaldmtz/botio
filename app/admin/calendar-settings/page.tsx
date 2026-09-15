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

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function CalendarSettingsPage({ searchParams }: Props) {
  if (!isAdmin()) return <LoginForm />;

  const status = await getCalendarConnectionStatus();
  const justConnected = searchParams.connected === '1';
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

        {justConnected && status.healthy ? (
          <p className="mb-4 rounded-md border border-bg-border bg-bg px-3 py-2 text-sm text-fg">
            Google Calendar reconectado correctamente.
          </p>
        ) : null}

        {status.connected ? (
          <div className="space-y-4">
            <p className="text-sm text-fg">
              {status.healthy ? '✅' : '⚠️'} Conectado como{' '}
              <strong>{status.hostEmail}</strong>
            </p>

            {status.healthy ? (
              <p className="text-xs text-fg-muted">
                La conexión usa un refresh token permanente. El access token (~1 h) se renueva
                automáticamente al agendar demos.
              </p>
            ) : (
              <p className="rounded-md bg-semantic-hot/10 px-3 py-2 text-xs text-semantic-hot">
                El refresh token no es válido
                {status.healthError ? ` (${status.healthError})` : ''}. Reconecta abajo — si
                persiste, revoca Botio en{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  myaccount.google.com/permissions
                </a>{' '}
                y vuelve a autorizar.
              </p>
            )}

            <dl className="space-y-1 text-xs text-fg-muted">
              <div className="flex justify-between gap-4">
                <dt>Última autorización</dt>
                <dd>{formatDateTime(status.authorizedAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Access token válido hasta</dt>
                <dd>{formatDateTime(status.accessTokenExpiresAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Refresh token</dt>
                <dd>{status.hasRefreshToken ? 'Presente' : 'Ausente'}</dd>
              </div>
            </dl>

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
