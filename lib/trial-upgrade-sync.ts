import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getKalyoClient } from '@/lib/kalyo-supabase';
import { processCustomerPaid } from '@/lib/conversation-outcome';

const PAID_SUBSCRIPTION_STATUSES = new Set(['active', 'past_due']);

type KalyoPaidPsychologist = {
  email: string;
  full_name: string | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
};

export type TrialUpgradeSyncSummary = {
  kalyo_active_subscribers: number;
  onboarding_marked: number;
  already_marked: number;
  errors: number;
};

/**
 * Backfill trial_onboarding_messages.upgraded_to_paid_at from Kalyo psychologists
 * with an active Stripe subscription. Stripe webhooks land on Kalyo; this cron
 * keeps Botio onboarding metrics in sync.
 */
export async function syncTrialUpgradesFromKalyo(
  botio: SupabaseClient,
): Promise<TrialUpgradeSyncSummary> {
  const summary: TrialUpgradeSyncSummary = {
    kalyo_active_subscribers: 0,
    onboarding_marked: 0,
    already_marked: 0,
    errors: 0,
  };

  let kalyo;
  try {
    kalyo = getKalyoClient();
  } catch (error) {
    console.warn('[trial-upgrade-sync] Kalyo client unavailable', error);
    return summary;
  }

  const { data: rows, error } = await kalyo
    .from('psychologists')
    .select('email, full_name, subscription_status, stripe_subscription_id')
    .not('stripe_subscription_id', 'is', null)
    .in('subscription_status', Array.from(PAID_SUBSCRIPTION_STATUSES));

  if (error) {
    console.error('[trial-upgrade-sync] Kalyo query failed', error);
    summary.errors += 1;
    return summary;
  }

  const paidRows = (rows ?? []) as KalyoPaidPsychologist[];
  summary.kalyo_active_subscribers = paidRows.length;

  for (const row of paidRows) {
    const email = row.email?.trim().toLowerCase();
    if (!email || !email.includes('@')) continue;

    const { data: existing } = await botio
      .from('trial_onboarding_messages')
      .select('id, upgraded_to_paid_at')
      .eq('trial_user_email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existing) continue;
    if (existing.upgraded_to_paid_at) {
      summary.already_marked += 1;
      continue;
    }

    try {
      const result = await processCustomerPaid(botio, email, 'kalyo_upgrade', {
        name: row.full_name,
      });
      if (result.onboarding_updated > 0) {
        summary.onboarding_marked += result.onboarding_updated;
      }
    } catch (syncError) {
      summary.errors += 1;
      console.error('[trial-upgrade-sync] mark paid failed', { email, syncError });
    }
  }

  if (summary.onboarding_marked > 0) {
    console.log(
      `[trial-upgrade-sync] marked ${summary.onboarding_marked} trial onboarding rows from Kalyo`,
    );
  }

  return summary;
}
