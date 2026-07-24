import 'server-only';
import { format, startOfMonth, subDays } from 'date-fns';
import { createAdminClient } from '@/lib/supabase/admin';
import { getKalyoClient } from '@/lib/kalyo-supabase';
import { fetchMetaAds } from '@/lib/meta-api';
import { fetchGoogleAds } from '@/lib/google-ads-api';
import { copToUsd, getUsdFxRates, mxnToUsd } from '@/lib/fx-rates';
import { computeLtvCacRatio, computeLtvDerived } from '@/lib/kpi/ltv-utils';

const PRO_PRICE_USD = 29;
const MAX_PRICE_USD = 39;

const EXCLUDED_TRIAL_STATUSES = new Set(['active', 'canceled', 'inactive']);

type PsychologistRow = {
  plan: string;
  subscription_status: string | null;
  trial_ends_at: string | null;
};

type ChurnedPsychologistRow = {
  subscription_status: string | null;
  updated_at: string | null;
};

type CacMetrics = {
  cac_usd_30d: number | null;
  cac_usd_alltime: number | null;
  new_subscribers_30d: number;
  total_paying_customers: number;
  /** Legacy: Meta spend in account currency (MXN). */
  ad_spend_30d_mxn: number;
  ad_spend_alltime_mxn: number;
  meta_spend_30d_usd: number;
  google_spend_30d_usd: number;
  meta_spend_alltime_usd: number;
  google_spend_alltime_usd: number;
  ad_spend_30d_usd: number;
  ad_spend_alltime_usd: number;
  fx_mxn_per_usd: number;
  fx_cop_per_usd: number;
};

function isChurnedInLast30Days(row: ChurnedPsychologistRow, since: Date): boolean {
  const status = row.subscription_status ?? '';
  if (status !== 'canceled' && status !== 'inactive') return false;
  if (!row.updated_at) return false;
  return new Date(row.updated_at).getTime() >= since.getTime();
}

function isActiveTrial(row: PsychologistRow): boolean {
  const status = row.subscription_status ?? '';
  if (EXCLUDED_TRIAL_STATUSES.has(status)) return false;
  if (!row.trial_ends_at) return false;
  return new Date(row.trial_ends_at).getTime() > Date.now();
}

function sumMetaSpend(rows: { spend?: string }[]): number {
  return rows.reduce((sum, row) => sum + Number(row.spend || 0), 0);
}

function cacFromSpendUsd(spendUsd: number, customers: number): number | null {
  if (spendUsd <= 0 || customers <= 0) return null;
  return spendUsd / customers;
}

async function getActiveSubscribers30dAgo(
  botio: ReturnType<typeof createAdminClient>,
  fallback: number,
): Promise<number> {
  const date30dAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const { data: snap30d } = await botio
    .from('kalyo_metrics')
    .select('active_subscribers')
    .lte('date', date30dAgo)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snap30d?.active_subscribers != null) return snap30d.active_subscribers;

  const { data: firstSnap } = await botio
    .from('kalyo_metrics')
    .select('active_subscribers')
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle();

  return firstSnap?.active_subscribers ?? fallback;
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

async function resolveCacMetrics(input: {
  active_subscribers: number;
  churned_30d: number;
  churned_alltime: number;
  active_subscribers_30d_ago: number;
}): Promise<CacMetrics> {
  const new_subscribers_30d = Math.max(
    0,
    input.active_subscribers - input.active_subscribers_30d_ago + input.churned_30d,
  );
  const total_paying_customers = input.active_subscribers + input.churned_alltime;

  const fx = await getUsdFxRates();

  let ad_spend_30d_mxn = 0;
  let ad_spend_alltime_mxn = 0;
  try {
    const [ads30, adsAll] = await Promise.all([
      fetchMetaAds('last_30d'),
      fetchMetaAds('maximum'),
    ]);
    ad_spend_30d_mxn = sumMetaSpend(ads30);
    ad_spend_alltime_mxn = sumMetaSpend(adsAll);
  } catch (err) {
    console.warn('[kalyo-metrics] Meta Ads unavailable for CAC', err);
  }

  let google_30d_cop = 0;
  let google_alltime_cop = 0;
  try {
    const google = await fetchGoogleAds();
    google_30d_cop = google.spend_30d_cop;
    google_alltime_cop = google.spend_alltime_cop;
  } catch (err) {
    console.warn('[kalyo-metrics] Google Ads unavailable for CAC', err);
  }

  const meta_spend_30d_usd = mxnToUsd(ad_spend_30d_mxn, fx.mxn_per_usd);
  const meta_spend_alltime_usd = mxnToUsd(ad_spend_alltime_mxn, fx.mxn_per_usd);
  const google_spend_30d_usd = copToUsd(google_30d_cop, fx.cop_per_usd);
  const google_spend_alltime_usd = copToUsd(google_alltime_cop, fx.cop_per_usd);
  const ad_spend_30d_usd = meta_spend_30d_usd + google_spend_30d_usd;
  const ad_spend_alltime_usd = meta_spend_alltime_usd + google_spend_alltime_usd;

  return {
    cac_usd_30d: cacFromSpendUsd(ad_spend_30d_usd, new_subscribers_30d),
    cac_usd_alltime: cacFromSpendUsd(ad_spend_alltime_usd, total_paying_customers),
    new_subscribers_30d,
    total_paying_customers,
    ad_spend_30d_mxn,
    ad_spend_alltime_mxn,
    meta_spend_30d_usd,
    google_spend_30d_usd,
    meta_spend_alltime_usd,
    google_spend_alltime_usd,
    ad_spend_30d_usd,
    ad_spend_alltime_usd,
    fx_mxn_per_usd: fx.mxn_per_usd,
    fx_cop_per_usd: fx.cop_per_usd,
  };
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
  ltv_cac_ratio: number | null;
  ltv_cac_ratio_alltime: number | null;
  avg_mrr_per_subscriber: number;
  avg_ltv_months: number | null;
  ltv_pro: number;
  ltv_max: number;
  cac_usd: number | null;
  cac_usd_alltime: number | null;
  new_subscribers_30d: number;
  total_paying_customers: number;
  ad_spend_30d_mxn: number;
  ad_spend_alltime_mxn: number;
  ad_spend_30d_usd: number;
  ad_spend_alltime_usd: number;
  meta_spend_30d_usd: number;
  google_spend_30d_usd: number;
  meta_spend_alltime_usd: number;
  google_spend_alltime_usd: number;
  fx_mxn_per_usd: number;
  fx_cop_per_usd: number;
}> {
  const kalyo = getKalyoClient();
  const since30d = subDays(new Date(), 30);

  const [
    { data: activeRows, error },
    { data: churnCandidates, error: churnError },
    { count: churnedAlltime, error: churnAllError },
  ] = await Promise.all([
    kalyo.from('psychologists').select('plan, subscription_status, trial_ends_at'),
    kalyo
      .from('psychologists')
      .select('subscription_status, updated_at')
      .in('subscription_status', ['canceled', 'inactive']),
    kalyo
      .from('psychologists')
      .select('*', { count: 'exact', head: true })
      .in('subscription_status', ['canceled', 'inactive']),
  ]);

  if (error) throw error;
  if (churnError) throw churnError;
  if (churnAllError) throw churnAllError;

  const rows = (activeRows ?? []) as PsychologistRow[];
  let mrr = 0;
  let active_subscribers = 0;
  let trialing = 0;
  let plan_pro = 0;
  let plan_max = 0;

  for (const row of rows) {
    if (isActiveTrial(row)) {
      trialing += 1;
      continue;
    }

    const status = row.subscription_status ?? '';
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

  const [{ data: prev }, activeStart, activeSubscribers30dAgo] = await Promise.all([
    botio.from('kalyo_metrics').select('active_subscribers').eq('date', yesterday).maybeSingle(),
    getActiveSubscribersStartOfMonth(botio, monthStart, active_subscribers + churned_30d),
    getActiveSubscribers30dAgo(botio, active_subscribers),
  ]);

  const prevActive = prev?.active_subscribers ?? active_subscribers;
  const delta = active_subscribers - prevActive;
  const converted_today = Math.max(0, delta);
  const churned_today = Math.max(0, -delta);

  const churn_rate =
    activeStart > 0 ? Number(((churned_30d / activeStart) * 100).toFixed(2)) : 0;

  const cac = await resolveCacMetrics({
    active_subscribers,
    churned_30d,
    churned_alltime: churnedAlltime ?? 0,
    active_subscribers_30d_ago: activeSubscribers30dAgo,
  });

  const ltv = computeLtvDerived({
    mrr: Number(mrr.toFixed(2)),
    active_subscribers,
    churn_rate,
    cac_usd: cac.cac_usd_30d,
  });

  const ltv_cac_ratio_alltime = computeLtvCacRatio(ltv.ltv_avg, cac.cac_usd_alltime);

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
    ltv_cac_ratio:
      ltv.ltv_cac_ratio != null ? Number(ltv.ltv_cac_ratio.toFixed(2)) : null,
    ltv_cac_ratio_alltime:
      ltv_cac_ratio_alltime != null ? Number(ltv_cac_ratio_alltime.toFixed(2)) : null,
    cac_usd: cac.cac_usd_30d != null ? Number(cac.cac_usd_30d.toFixed(2)) : null,
    cac_usd_alltime:
      cac.cac_usd_alltime != null ? Number(cac.cac_usd_alltime.toFixed(2)) : null,
    new_subscribers_30d: cac.new_subscribers_30d,
    total_paying_customers: cac.total_paying_customers,
    ad_spend_30d_mxn: Number(cac.ad_spend_30d_mxn.toFixed(2)),
    ad_spend_alltime_mxn: Number(cac.ad_spend_alltime_mxn.toFixed(2)),
    ad_spend_30d_usd: Number(cac.ad_spend_30d_usd.toFixed(2)),
    ad_spend_alltime_usd: Number(cac.ad_spend_alltime_usd.toFixed(2)),
    meta_spend_30d_usd: Number(cac.meta_spend_30d_usd.toFixed(2)),
    google_spend_30d_usd: Number(cac.google_spend_30d_usd.toFixed(2)),
    meta_spend_alltime_usd: Number(cac.meta_spend_alltime_usd.toFixed(2)),
    google_spend_alltime_usd: Number(cac.google_spend_alltime_usd.toFixed(2)),
    fx_mxn_per_usd: Number(cac.fx_mxn_per_usd.toFixed(4)),
    fx_cop_per_usd: Number(cac.fx_cop_per_usd.toFixed(4)),
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
  };
}
