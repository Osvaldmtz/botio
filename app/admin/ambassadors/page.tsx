import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { AdminShell } from '@/components/admin/admin-shell';
import { AmbassadorsDashboard } from './components/ambassadors-dashboard';

export const dynamic = 'force-dynamic';

export default function AmbassadorsPage() {
  if (!isAdmin()) return <LoginForm />;

  return (
    <AdminShell
      title="🎓 Embajadores Kalyo"
      subtitle="Programa de afiliados — separado del pipeline de ventas."
    >
      <AmbassadorsDashboard />
    </AdminShell>
  );
}
