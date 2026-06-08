import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { MetricsDashboard } from './components/metrics-dashboard';

export const dynamic = 'force-dynamic';

export default function AdminMetricsDashboardPage() {
  if (!isAdmin()) return <LoginForm />;
  return <MetricsDashboard />;
}
