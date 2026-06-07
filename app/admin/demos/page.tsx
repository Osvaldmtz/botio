import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { AdminShell } from '@/components/admin/admin-shell';
import { DemosDashboard } from './components/demos-dashboard';

export const dynamic = 'force-dynamic';

export default function DemosPage() {
  if (!isAdmin()) return <LoginForm />;

  return (
    <AdminShell
      title="Demos agendadas"
      subtitle="Demos creadas por Sofía vía Google Calendar."
    >
      <DemosDashboard />
    </AdminShell>
  );
}
