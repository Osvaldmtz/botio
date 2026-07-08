import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { fetchLandingCtasPageData } from '@/lib/kpi-queries';
import { LandingCtasDashboard } from './components/landing-ctas-dashboard';

export const dynamic = 'force-dynamic';

export default async function LandingCtasKpisPage() {
  if (!isAdmin()) return <LoginForm />;
  const data = await fetchLandingCtasPageData();
  return <LandingCtasDashboard data={data} />;
}
