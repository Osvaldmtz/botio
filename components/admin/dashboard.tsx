import { createBotAction, logoutAction } from '@/app/admin/actions';

const createBotFormAction = createBotAction as unknown as (
  formData: FormData,
) => void | Promise<void>;

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
        <form
          action={createBotFormAction}
          className="grid gap-4 rounded-lg border border-bg-border bg-bg-elevated p-6"
        >
          <Field label="Business name" name="business_name" required />
          <Field label="Bot name" name="bot_name" required />
          <Field
            label="System prompt"
            name="system_prompt"
            textarea
            placeholder="You are a helpful assistant for..."
          />
          <Field label="Twilio Account SID" name="twilio_account_sid" />
          <Field label="Twilio Auth Token" name="twilio_auth_token" type="password" />
          <Field
            label="Twilio WhatsApp number"
            name="twilio_whatsapp_number"
            placeholder="whatsapp:+1234567890"
          />
          <button
            type="submit"
            className="justify-self-start rounded-md bg-accent px-4 py-2 font-semibold text-bg hover:bg-accent-hover"
          >
            Create bot
          </button>
        </form>
      </section>
    </main>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  textarea?: boolean;
};

function Field({ label, name, type = 'text', required, placeholder, textarea }: FieldProps) {
  const classes =
    'bg-bg border-bg-border text-fg focus:border-accent w-full rounded-md border px-3 py-2 outline-none';
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-wide text-fg-muted">{label}</span>
      {textarea ? (
        <textarea
          name={name}
          required={required}
          placeholder={placeholder}
          rows={4}
          className={classes}
        />
      ) : (
        <input
          type={type}
          name={name}
          required={required}
          placeholder={placeholder}
          className={classes}
        />
      )}
    </label>
  );
}
