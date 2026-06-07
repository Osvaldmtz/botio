import { loginAction } from '@/app/admin/actions';

const loginFormAction = loginAction as unknown as (formData: FormData) => void | Promise<void>;

export function LoginForm() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-elevated px-6">
      <form
        action={loginFormAction}
        className="w-full max-w-sm space-y-5 rounded-card border border-bg-border bg-bg p-8"
      >
        <div>
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded bg-accent text-sm font-semibold text-white">
            B
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Botio Admin</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Acceso temporal con contraseña. Auth completo próximamente.
          </p>
        </div>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-fg-tertiary">
            Contraseña
          </span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="w-full rounded border border-bg-border bg-bg px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded bg-accent px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Iniciar sesión
        </button>
      </form>
    </main>
  );
}
