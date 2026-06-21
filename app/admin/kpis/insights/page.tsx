import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { fetchKpiInsightsData } from '@/lib/kpi-queries';
import { InsightsPanel } from './components/insights-panel';

export const dynamic = 'force-dynamic';

export default async function KpiInsightsPage() {
  if (!isAdmin()) return <LoginForm />;

  const kpiData = await fetchKpiInsightsData();
  return <InsightsPanel data={kpiData} />;
}
