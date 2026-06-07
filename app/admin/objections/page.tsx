import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { AdminShell } from '@/components/admin/admin-shell';
import { ObjectionsDashboard } from './components/objections-dashboard';

export const dynamic = 'force-dynamic';

export default function ObjectionsPage() {
  if (!isAdmin()) return <LoginForm />;

  return (
    <AdminShell
      title="Objeciones"
      subtitle="Detección automática de objeciones comunes y seguimiento de outcomes."
    >
      <ObjectionsDashboard />
    </AdminShell>
  );
}
