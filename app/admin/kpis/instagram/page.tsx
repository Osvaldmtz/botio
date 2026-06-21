import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { fetchInstagramPageData } from '@/lib/kpi-queries';
import { InstagramKpiDashboard } from './components/instagram-kpi-dashboard';

export const dynamic = 'force-dynamic';

export default async function InstagramKpisPage() {
  if (!isAdmin()) return <LoginForm />;
  const data = await fetchInstagramPageData();
  return <InstagramKpiDashboard data={data} />;
}
