import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { AdminShell } from '@/components/admin/admin-shell';
import { RoadmapDashboard } from './components/roadmap-dashboard';

export const dynamic = 'force-dynamic';

export default function RoadmapPage() {
  if (!isAdmin()) return <LoginForm />;

  return (
    <AdminShell
      title="ML Roadmap"
      subtitle="Recordatorios para Fases 3, 4 y 5 del ML del Pobre."
    >
      <RoadmapDashboard />
    </AdminShell>
  );
}
