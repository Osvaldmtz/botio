import { loginAction } from '@/app/admin/actions';

const loginFormAction = loginAction as unknown as (
  formData: FormData,
) => void | Promise<void>;

export function LoginForm() {
  return (
    <main className="bg-gradient-glow flex min-h-screen items-center justify-center px-6">
      <form
        action={loginFormAction}
        className="bg-bg-elevated border-bg-border w-full max-w-sm space-y-4 rounded-xl border p-8"
      >
        <h1 className="text-fg text-2xl font-semibold">Admin</h1>
        <p className="text-fg-muted text-sm">
          Temporary password-protected area. Real auth coming soon.
        </p>
        <label className="block space-y-1">
          <span className="text-fg-muted text-xs uppercase tracking-wide">
            Password
          </span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="bg-bg border-bg-border text-fg focus:border-accent w-full rounded-md border px-3 py-2 outline-none"
          />
        </label>
        <button
          type="submit"
          className="bg-accent text-bg hover:bg-accent-hover w-full rounded-md px-3 py-2 font-semibold transition-colors"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
