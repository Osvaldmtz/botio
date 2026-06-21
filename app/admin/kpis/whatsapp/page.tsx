import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { getTwilioMetrics } from '@/lib/kpi-queries';
import { WhatsappKpiDashboard } from './components/whatsapp-kpi-dashboard';

export const dynamic = 'force-dynamic';

export default async function WhatsappKpisPage() {
  if (!isAdmin()) return <LoginForm />;
  const rows = await getTwilioMetrics(30);
  return <WhatsappKpiDashboard rows={rows} />;
}
