import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { fetchAdsPageData } from '@/lib/kpi-queries';
import { AdsKpiDashboard } from './components/ads-kpi-dashboard';

export const dynamic = 'force-dynamic';

export default async function AdsKpisPage() {
  if (!isAdmin()) return <LoginForm />;
  const data = await fetchAdsPageData();
  return <AdsKpiDashboard data={data} />;
}
