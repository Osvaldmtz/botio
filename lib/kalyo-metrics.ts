import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { format, subDays } from 'date-fns';
import { createAdminClient } from '@/lib/supabase/admin';

const PRO_PRICE_USD = 29;
const MAX_PRICE_USD = 39;

type PsychologistRow = {
  plan: string;
  subscription_status: string | null;
};

function createKalyoClient() {
  const url = process.env.KALYO_SUPABASE_URL;
  const key = process.env.KALYO_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Missing KALYO_SUPABASE_URL or KALYO_SUPABASE_SERVICE_KEY');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function syncKalyoMetrics(): Promise<{
  date: string;
  mrr: number;
  active_subscribers: number;
  trialing: number;
  plan_pro: number;
  plan_max: number;
}> {
  const kalyo = createKalyoClient();
  const { data, error } = await kalyo
    .from('psychologists')
    .select('plan, subscription_status');

  if (error) throw error;

  const rows = (data ?? []) as PsychologistRow[];
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

  const today = format(new Date(), 'yyyy-MM-dd');
  const botio = createAdminClient();
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const { data: prev } = await botio
    .from('kalyo_metrics')
    .select('active_subscribers')
    .eq('date', yesterday)
    .maybeSingle();

  const prevActive = prev?.active_subscribers ?? active_subscribers;
  const delta = active_subscribers - prevActive;
  const converted_today = Math.max(0, delta);
  const churned_today = Math.max(0, -delta);

  const payload = {
    date: today,
    mrr: Number(mrr.toFixed(2)),
    active_subscribers,
    trialing,
    converted_today,
    churned_today,
    plan_pro,
    plan_max,
    synced_at: new Date().toISOString(),
  };

  const { error: upsertError } = await botio.from('kalyo_metrics').upsert(payload, {
    onConflict: 'date',
  });
  if (upsertError) throw upsertError;

  return payload;
}
