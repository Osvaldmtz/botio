import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { AdminShell } from '@/components/admin/admin-shell';
import { LearningDashboard } from './components/learning-dashboard';

export const dynamic = 'force-dynamic';

export default function LearningPage() {
  if (!isAdmin()) return <LoginForm />;

  return (
    <AdminShell
      title="ML del Pobre — Fase 1"
      subtitle="Outcome tracking para aprender qué patrones convierten."
    >
      <LearningDashboard />
    </AdminShell>
  );
}
