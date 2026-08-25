import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { createAdminClient } from '@/lib/supabase/admin';
import { getKalyoMetricsHistory, getLatestKalyoMetrics } from '@/lib/kpi-queries';
import { fetchStripeActiveSubscriberCount, getMRRCached } from '@/lib/stripe-mrr';
import { getActiveManualMrrUsd } from '@/lib/manual-payments';
import { RevenueKpiDashboard } from './components/revenue-kpi-dashboard';

export const dynamic = 'force-dynamic';

export default async function RevenueKpisPage() {
  if (!isAdmin()) return <LoginForm />;
  const botio = createAdminClient();
  const [latest, history, stripeSubs, stripeMrr, manualMrr] = await Promise.all([
    getLatestKalyoMetrics(),
    getKalyoMetricsHistory(90),
    fetchStripeActiveSubscriberCount(),
    getMRRCached(),
    getActiveManualMrrUsd(botio),
  ]);
  const stripeMrrUsd = stripeMrr.available ? stripeMrr.current_mrr_usd : null;
  const manualMrrUsd = manualMrr.manual_mrr_usd;
  const totalMrr =
    stripeMrrUsd != null
      ? Math.round((stripeMrrUsd + manualMrrUsd) * 100) / 100
      : Math.round(manualMrrUsd * 100) / 100;
  return (
    <RevenueKpiDashboard
      latest={latest}
      history={history}
      stripeActiveSubscribers={stripeSubs.count}
      stripeMrr={stripeMrrUsd}
      manualMrr={manualMrrUsd}
      totalMrr={totalMrr}
    />
  );
}
