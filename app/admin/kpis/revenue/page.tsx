import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { getKalyoMetricsHistory, getLatestKalyoMetrics } from '@/lib/kpi-queries';
import { fetchStripeActiveSubscriberCount, getMRRCached } from '@/lib/stripe-mrr';
import { RevenueKpiDashboard } from './components/revenue-kpi-dashboard';

export const dynamic = 'force-dynamic';

export default async function RevenueKpisPage() {
  if (!isAdmin()) return <LoginForm />;
  const [latest, history, stripeSubs, stripeMrr] = await Promise.all([
    getLatestKalyoMetrics(),
    getKalyoMetricsHistory(90),
    fetchStripeActiveSubscriberCount(),
    getMRRCached(),
  ]);
  return (
    <RevenueKpiDashboard
      latest={latest}
      history={history}
      stripeActiveSubscribers={stripeSubs.count}
      stripeMrr={stripeMrr.available ? stripeMrr.current_mrr_usd : null}
    />
  );
}
