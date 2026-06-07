import Link from 'next/link';
import { logoutAction } from '@/app/admin/actions';
import { CreateBotForm } from '@/components/admin/create-bot-form';
import { AdminHeader } from '@/components/admin/admin-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Business = {
  id: string;
  name: string;
  created_at: string;
};

type Bot = {
  id: string;
  name: string;
  business_id: string;
  is_active: boolean;
  twilio_whatsapp_number: string | null;
  created_at: string;
};

type DashboardProps = {
  businesses: Business[];
  bots: Bot[];
};

export function Dashboard({ businesses, bots }: DashboardProps) {
  const businessById = new Map(businesses.map((b) => [b.id, b]));

  return (
    <div className="min-h-screen bg-bg">
      <AdminHeader />
      <main className="mx-auto max-w-dashboard px-4 py-8 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Configuración</h1>
            <p className="mt-1 text-sm text-fg-muted">Gestión de negocios y bots.</p>
          </div>
          <Link href="/admin/conversations">
            <Button variant="secondary" size="sm">
              Ir a conversaciones
            </Button>
          </Link>
        </header>

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-fg">
            Negocios ({businesses.length})
          </h2>
          {businesses.length === 0 ? (
            <p className="text-sm text-fg-muted">No hay negocios aún.</p>
          ) : (
            <Card className="divide-y divide-bg-border p-0">
              {businesses.map((b) => (
                <div key={b.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium text-fg">{b.name}</span>
                  <span className="font-mono text-xs text-fg-tertiary">{b.id}</span>
                </div>
              ))}
            </Card>
          )}
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-fg">Bots ({bots.length})</h2>
          {bots.length === 0 ? (
            <p className="text-sm text-fg-muted">No hay bots aún.</p>
          ) : (
            <div className="space-y-2">
              {bots.map((bot) => (
                <Card key={bot.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-fg">{bot.name}</p>
                    <p className="text-xs text-fg-muted">
                      {businessById.get(bot.business_id)?.name ?? bot.business_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-medium ${bot.is_active ? 'text-accent-muted-fg' : 'text-fg-tertiary'}`}
                    >
                      {bot.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                    <Link
                      href="/admin/conversations"
                      className="text-xs text-fg-muted hover:text-fg"
                    >
                      Ver leads →
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-fg">Crear bot</h2>
          <Card>
            <CreateBotForm />
          </Card>
        </section>

        <form action={logoutAction} className="mt-8">
          <Button variant="ghost" size="sm" type="submit">
            Cerrar sesión
          </Button>
        </form>
      </main>
    </div>
  );
}
