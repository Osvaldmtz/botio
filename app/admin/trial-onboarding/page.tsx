import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { AdminShell } from '@/components/admin/admin-shell';
import { TrialOnboardingDashboard } from './components/trial-onboarding-dashboard';

export const dynamic = 'force-dynamic';

export default function TrialOnboardingPage() {
  if (!isAdmin()) return <LoginForm />;

  return (
    <AdminShell
      title="Onboarding trials"
      subtitle="Mensajes automáticos días 1, 3, 5, 6 y 7 del trial Max."
    >
      <TrialOnboardingDashboard />
    </AdminShell>
  );
}
