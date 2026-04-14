import { loginAction } from '@/app/admin/actions';

const loginFormAction = loginAction as unknown as (formData: FormData) => void | Promise<void>;

export function LoginForm() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-glow px-6">
      <form
        action={loginFormAction}
        className="w-full max-w-sm space-y-4 rounded-xl border border-bg-border bg-bg-elevated p-8"
      >
        <h1 className="text-2xl font-semibold text-fg">Admin</h1>
        <p className="text-sm text-fg-muted">
          Temporary password-protected area. Real auth coming soon.
        </p>
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wide text-fg-muted">Password</span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="w-full rounded-md border border-bg-border bg-bg px-3 py-2 text-fg outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-accent px-3 py-2 font-semibold text-bg transition-colors hover:bg-accent-hover"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
