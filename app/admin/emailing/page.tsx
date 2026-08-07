import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { AdminShell } from '@/components/admin/admin-shell';
import { EmailingDashboard } from './components/emailing-dashboard';

export const dynamic = 'force-dynamic';

export default function EmailingPage() {
  if (!isAdmin()) return <LoginForm />;

  return (
    <AdminShell
      title="Emailing"
      subtitle="Secuencias de onboarding y métricas de envío con Resend."
    >
      <EmailingDashboard />
    </AdminShell>
  );
}
