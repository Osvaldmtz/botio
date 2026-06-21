import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { fetchWebPageData } from '@/lib/kpi-queries';
import { WebKpiDashboard } from './components/web-kpi-dashboard';

export const dynamic = 'force-dynamic';

export default async function WebKpisPage() {
  if (!isAdmin()) return <LoginForm />;
  const data = await fetchWebPageData();
  return <WebKpiDashboard data={data} />;
}
