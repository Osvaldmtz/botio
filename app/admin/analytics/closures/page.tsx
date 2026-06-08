import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { AdminShell } from '@/components/admin/admin-shell';
import { ClosuresAnalyticsDashboard } from './components/closures-analytics-dashboard';

export const dynamic = 'force-dynamic';

export default function ClosuresAnalyticsPage() {
  if (!isAdmin()) return <LoginForm />;

  return (
    <AdminShell
      title="Cierres de conversación"
      subtitle="Razones de cierre admin (últimos 30 días) para mejorar conversión."
    >
      <ClosuresAnalyticsDashboard />
    </AdminShell>
  );
}
