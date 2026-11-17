import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { createAdminClient } from '@/lib/supabase/admin';
import { getKalyoMetricsHistory, getLatestKalyoMetrics } from '@/lib/kpi-queries';
import { fetchStripeActiveSubscriberCount, getMRRCached } from '@/lib/stripe-mrr';
import { getChurnRate, getPastDueSnapshot } from '@/lib/stripe-metrics';
import { getManualOnlySubscriberStats } from '@/lib/manual-payments';
import { computeLtvDerived } from '@/lib/kpi/ltv-utils';
import { RevenueKpiDashboard } from './components/revenue-kpi-dashboard';

export const dynamic = 'force-dynamic';

export default async function RevenueKpisPage() {
  if (!isAdmin()) return <LoginForm />;
  const botio = createAdminClient();
  const [latest, history, stripeSubs, stripeMrr, manualStats, stripeChurn, pastDue] =
    await Promise.all([
      getLatestKalyoMetrics(),
      getKalyoMetricsHistory(90),
      fetchStripeActiveSubscriberCount(),
      getMRRCached(),
      getManualOnlySubscriberStats(botio),
      getChurnRate(),
      getPastDueSnapshot(),
    ]);
  const stripeMrrUsd = stripeMrr.available ? stripeMrr.current_mrr_usd : null;
  const manualMrrUsd = manualStats.manual_mrr_usd;
  const totalMrr =
    stripeMrrUsd != null
      ? Math.round((stripeMrrUsd + manualMrrUsd) * 100) / 100
      : Math.round(manualMrrUsd * 100) / 100;
  const totalActiveSubscribers =
    (stripeSubs.count ?? 0) + manualStats.active_count;
  const totalNewSubsThisMonth = stripeMrr.available
    ? stripeMrr.new_subs_this_month + manualStats.new_this_month
    : manualStats.new_this_month;

  const stripeChurnRate = stripeChurn.available ? stripeChurn.churn_rate_pct : null;
  const stripeChurned30d = stripeChurn.available ? stripeChurn.canceled_30d : null;
  const stripeLtv =
    stripeMrrUsd != null &&
    stripeChurnRate != null &&
    (stripeSubs.count ?? 0) > 0
      ? computeLtvDerived({
          mrr: stripeMrrUsd,
          active_subscribers: stripeSubs.count ?? 0,
          churn_rate: stripeChurnRate,
          cac_usd: latest?.cac_usd != null ? Number(latest.cac_usd) : null,
        })
      : null;

  return (
    <RevenueKpiDashboard
      latest={latest}
      history={history}
      stripeActiveSubscribers={stripeSubs.count}
      stripeCompedSubscribers={stripeSubs.comped}
      stripeMrr={stripeMrrUsd}
      manualMrr={manualMrrUsd}
      totalMrr={totalMrr}
      totalActiveSubscribers={totalActiveSubscribers}
      manualActiveOnly={manualStats.active_count}
      totalNewSubsThisMonth={totalNewSubsThisMonth}
      stripeChurnRate={stripeChurnRate}
      stripeChurned30d={stripeChurned30d}
      stripeChurnedThisMonth={stripeMrr.available ? stripeMrr.churned_this_month : null}
      stripeLtvAvg={stripeLtv?.ltv_avg ?? null}
      pastDueActionable={pastDue.available ? pastDue.past_due_actionable : null}
      stripeMrrError={stripeMrr.available ? null : (stripeMrr.error ?? 'unavailable')}
    />
  );
}
