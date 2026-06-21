import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { fetchExecutiveSummary } from '@/lib/kpi-queries';
import { ExecutiveKpiDashboard } from './components/executive-kpi-dashboard';

export const dynamic = 'force-dynamic';

export default async function KpisPage() {
  if (!isAdmin()) return <LoginForm />;

  const data = await fetchExecutiveSummary();
  return <ExecutiveKpiDashboard data={data} />;
}
