import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { getKalyoMetricsHistory, getLatestKalyoMetrics } from '@/lib/kpi-queries';
import { RevenueKpiDashboard } from './components/revenue-kpi-dashboard';

export const dynamic = 'force-dynamic';

export default async function RevenueKpisPage() {
  if (!isAdmin()) return <LoginForm />;
  const [latest, history] = await Promise.all([
    getLatestKalyoMetrics(),
    getKalyoMetricsHistory(90),
  ]);
  return <RevenueKpiDashboard latest={latest} history={history} />;
}
