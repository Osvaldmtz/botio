import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { getSeoKpis } from '@/lib/dataforseo-api';
import { SeoDashboard } from './components/seo-dashboard';

export const dynamic = 'force-dynamic';

export default async function SeoAdminPage() {
  if (!isAdmin()) return <LoginForm />;

  let initial = null;
  let error: string | null = null;

  try {
    initial = await getSeoKpis();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return <SeoDashboard initial={initial} error={error} />;
}
