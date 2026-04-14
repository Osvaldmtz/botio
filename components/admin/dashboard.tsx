import { logoutAction } from '@/app/admin/actions';
import { CreateBotForm } from '@/components/admin/create-bot-form';

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
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-fg">Admin dashboard</h1>
          <p className="text-sm text-fg-muted">Temporary bypass mode.</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-md border border-bg-border px-3 py-2 text-sm text-fg-muted hover:text-fg"
          >
            Log out
          </button>
        </form>
      </header>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold text-fg">Businesses ({businesses.length})</h2>
        {businesses.length === 0 ? (
          <p className="text-sm text-fg-muted">No businesses yet.</p>
        ) : (
          <ul className="divide-y divide-bg-border rounded-lg border border-bg-border bg-bg-elevated">
            {businesses.map((b) => (
              <li key={b.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-fg">{b.name}</span>
                <code className="text-xs text-fg-muted">{b.id}</code>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold text-fg">Bots ({bots.length})</h2>
        {bots.length === 0 ? (
          <p className="text-sm text-fg-muted">No bots yet.</p>
        ) : (
          <ul className="divide-y divide-bg-border rounded-lg border border-bg-border bg-bg-elevated">
            {bots.map((bot) => {
              const business = businessById.get(bot.business_id);
              return (
                <li key={bot.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-fg">{bot.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        bot.is_active ? 'bg-accent/20 text-accent' : 'bg-bg-border text-fg-muted'
                      }`}
                    >
                      {bot.is_active ? 'active' : 'inactive'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-xs text-fg-muted">
                    <span>Business: {business?.name ?? '—'}</span>
                    <span>WhatsApp: {bot.twilio_whatsapp_number ?? '—'}</span>
                    <code>webhook: /api/webhook/{bot.id}</code>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-fg">Create a new bot</h2>
        <CreateBotForm />
      </section>
    </main>
  );
}
