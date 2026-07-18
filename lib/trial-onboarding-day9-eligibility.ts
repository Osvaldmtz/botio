import type { SupabaseClient } from '@supabase/supabase-js';
import { KALYO_PRICING } from '@/lib/kalyo-pricing-data';

export type Day9Eligibility =
  | { action: 'send_coupon' }
  | { action: 'send_no_coupon' }
  | { action: 'skip'; reason: string; status: string };

export async function hadPriorCouponOffer(
  supabase: SupabaseClient,
  params: { conversationId: string | null; email: string },
): Promise<boolean> {
  if (params.conversationId) {
    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', params.conversationId)
      .filter('metadata->>coupon_offered', 'eq', 'true');

    if (error) {
      console.error('[trial-onboarding] coupon history lookup failed', error);
    } else if ((count ?? 0) > 0) {
      return true;
    }

    const { count: contentCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', params.conversationId)
      .ilike('content', `%${KALYO_PRICING.discount.code}%`);

    if ((contentCount ?? 0) > 0) {
      return true;
    }
  }

  const { count: rowCount } = await supabase
    .from('trial_onboarding_messages')
    .select('id', { count: 'exact', head: true })
    .eq('trial_user_email', params.email.trim().toLowerCase())
    .eq('day_9_status', 'sent_coupon');

  return (rowCount ?? 0) > 0;
}

export async function isKalyoSubscriptionActive(email: string): Promise<boolean> {
  try {
    const { getKalyoClient } = await import('@/lib/kalyo');
    const kalyo = getKalyoClient();
    const { data, error } = await kalyo
      .from('psychologists')
      .select('subscription_status')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('[trial-onboarding] kalyo subscription lookup failed', error);
      return false;
    }

    return (data?.subscription_status as string | null) === 'active';
  } catch (err) {
    console.error('[trial-onboarding] kalyo client unavailable', err);
    return false;
  }
}

export async function evaluateDay9Eligibility(
  supabase: SupabaseClient,
  row: {
    trial_user_email: string;
    trial_ends_at: string;
    conversation_id: string | null;
    unsubscribed: boolean;
    upgraded_to_paid_at: string | null;
    day_15_sent_at: string | null;
  },
): Promise<Day9Eligibility> {
  if (row.unsubscribed) {
    return { action: 'skip', reason: 'unsubscribed', status: 'skipped_unsubscribed' };
  }

  if (row.upgraded_to_paid_at) {
    return { action: 'skip', reason: 'upgraded_to_paid', status: 'skipped_paid' };
  }

  const trialEnded = new Date(row.trial_ends_at).getTime() < Date.now();
  if (!trialEnded) {
    return { action: 'skip', reason: 'trial_not_expired', status: 'skipped_trial_active' };
  }

  if (!row.day_15_sent_at) {
    return { action: 'skip', reason: 'day7_not_sent', status: 'skipped_pending_day7' };
  }

  if (await isKalyoSubscriptionActive(row.trial_user_email)) {
    return { action: 'skip', reason: 'active_subscription', status: 'skipped_paid' };
  }

  const hadCoupon = await hadPriorCouponOffer(supabase, {
    conversationId: row.conversation_id,
    email: row.trial_user_email,
  });

  if (hadCoupon) {
    return { action: 'send_no_coupon' };
  }

  return { action: 'send_coupon' };
}
