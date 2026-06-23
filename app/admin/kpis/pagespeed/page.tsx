import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { getPageSpeedHistory, getPageSpeedMetricsCached } from '@/lib/pagespeed-api';
import type { PageSpeedHistoryRow, PageSpeedMetrics } from '@/lib/pagespeed-utils';
import { PageSpeedDashboard } from './components/pagespeed-dashboard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function PageSpeedKpisPage() {
  if (!isAdmin()) return <LoginForm />;

  let initial: PageSpeedMetrics | null = null;
  let error: string | null = null;
  let history: PageSpeedHistoryRow[] = [];

  try {
    [initial, history] = await Promise.all([getPageSpeedMetricsCached(), getPageSpeedHistory(30)]);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    try {
      history = await getPageSpeedHistory(30);
    } catch {
      history = [];
    }
  }

  return <PageSpeedDashboard initial={initial} history={history} error={error} />;
}
