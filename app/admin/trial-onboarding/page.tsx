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
      subtitle="Onboarding trial Max: día 1 (welcome), 2, 3, 5, 6, 7 y opcional 9 (PRIMER50)."
    >
      <TrialOnboardingDashboard />
    </AdminShell>
  );
}
