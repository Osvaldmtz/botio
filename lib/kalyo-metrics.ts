import 'server-only';
import { format, startOfMonth, subDays } from 'date-fns';
import { createAdminClient } from '@/lib/supabase/admin';
import { getKalyoClient } from '@/lib/kalyo-supabase';
import { fetchMetaAds } from '@/lib/meta-api';
import {
  DEFAULT_CAC_USD,
  MXN_PER_USD,
  computeLtvDerived,
} from '@/lib/kpi/ltv-utils';

const PRO_PRICE_USD = 29;
const MAX_PRICE_USD = 39;

type PsychologistRow = {
  plan: string;
  subscription_status: string | null;
};

type ChurnedPsychologistRow = {
  subscription_status: string | null;
  updated_at: string | null;
};

function isChurnedInLast30Days(row: ChurnedPsychologistRow, since: Date): boolean {
  const status = row.subscription_status ?? '';
  if (status !== 'canceled' && status !== 'inactive') return false;
  if (!row.updated_at) return false;
  return new Date(row.updated_at).getTime() >= since.getTime();
}

async function resolveCacUsd(activeSubscribers: number): Promise<number> {
  if (activeSubscribers <= 0) return DEFAULT_CAC_USD;
  try {
    const ads = await fetchMetaAds('last_30d');
    const spendMxn = ads.reduce((sum, row) => sum + Number(row.spend || 0), 0);
    if (spendMxn > 0) {
      return spendMxn / MXN_PER_USD / activeSubscribers;
    }
  } catch (err) {
    console.warn('[kalyo-metrics] Meta Ads unavailable for CAC, using default', err);
  }
  return DEFAULT_CAC_USD;
}

async function getActiveSubscribersStartOfMonth(
  botio: ReturnType<typeof createAdminClient>,
  monthStart: string,
  fallback: number,
): Promise<number> {
  const { data: exact } = await botio
    .from('kalyo_metrics')
    .select('active_subscribers')
    .eq('date', monthStart)
    .maybeSingle();

  if (exact?.active_subscribers != null) return exact.active_subscribers;

  const { data: firstInMonth } = await botio
    .from('kalyo_metrics')
    .select('active_subscribers')
    .gte('date', monthStart)
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle();

  return firstInMonth?.active_subscribers ?? fallback;
}

export async function syncKalyoMetrics(): Promise<{
  date: string;
  mrr: number;
  active_subscribers: number;
  trialing: number;
  plan_pro: number;
  plan_max: number;
  churned_30d: number;
  churn_rate: number;
  ltv_avg: number;
  ltv_cac_ratio: number;
  avg_mrr_per_subscriber: number;
  avg_ltv_months: number | null;
  ltv_pro: number;
  ltv_max: number;
  cac_usd: number;
}> {
  const kalyo = getKalyoClient();
  const since30d = subDays(new Date(), 30);

  const [{ data: activeRows, error }, { data: churnCandidates, error: churnError }] =
    await Promise.all([
      kalyo.from('psychologists').select('plan, subscription_status'),
      kalyo
        .from('psychologists')
        .select('subscription_status, updated_at')
        .in('subscription_status', ['canceled', 'inactive']),
    ]);

  if (error) throw error;
  if (churnError) throw churnError;

  const rows = (activeRows ?? []) as PsychologistRow[];
  let mrr = 0;
  let active_subscribers = 0;
  let trialing = 0;
  let plan_pro = 0;
  let plan_max = 0;

  for (const row of rows) {
    const status = row.subscription_status ?? '';
    if (status === 'trialing') {
      trialing += 1;
      continue;
    }
    if (status !== 'active') continue;

    active_subscribers += 1;
    if (row.plan === 'starter') {
      plan_pro += 1;
      mrr += PRO_PRICE_USD;
    } else if (row.plan === 'professional' || row.plan === 'clinic') {
      plan_max += 1;
      mrr += MAX_PRICE_USD;
    }
  }

  const churned_30d = ((churnCandidates ?? []) as ChurnedPsychologistRow[]).filter((row) =>
    isChurnedInLast30Days(row, since30d),
  ).length;

  const today = format(new Date(), 'yyyy-MM-dd');
  const botio = createAdminClient();
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const [{ data: prev }, activeStart] = await Promise.all([
    botio.from('kalyo_metrics').select('active_subscribers').eq('date', yesterday).maybeSingle(),
    getActiveSubscribersStartOfMonth(
      botio,
      monthStart,
      active_subscribers + churned_30d,
    ),
  ]);

  const prevActive = prev?.active_subscribers ?? active_subscribers;
  const delta = active_subscribers - prevActive;
  const converted_today = Math.max(0, delta);
  const churned_today = Math.max(0, -delta);

  const churn_rate =
    activeStart > 0 ? Number(((churned_30d / activeStart) * 100).toFixed(2)) : 0;

  const cac_usd = await resolveCacUsd(active_subscribers);
  const ltv = computeLtvDerived({
    mrr: Number(mrr.toFixed(2)),
    active_subscribers,
    churn_rate,
    cac_usd,
  });

  const payload = {
    date: today,
    mrr: Number(mrr.toFixed(2)),
    active_subscribers,
    trialing,
    converted_today,
    churned_today,
    plan_pro,
    plan_max,
    churned_30d,
    churn_rate,
    ltv_avg: Number(ltv.ltv_avg.toFixed(2)),
    ltv_cac_ratio: Number(ltv.ltv_cac_ratio.toFixed(2)),
    synced_at: new Date().toISOString(),
  };

  const { error: upsertError } = await botio.from('kalyo_metrics').upsert(payload, {
    onConflict: 'date',
  });
  if (upsertError) throw upsertError;

  return {
    ...payload,
    avg_mrr_per_subscriber: Number(ltv.avg_mrr_per_subscriber.toFixed(2)),
    avg_ltv_months: ltv.avg_ltv_months,
    ltv_pro: Number(ltv.ltv_pro.toFixed(2)),
    ltv_max: Number(ltv.ltv_max.toFixed(2)),
    cac_usd: Number(ltv.cac_usd.toFixed(2)),
  };
}
