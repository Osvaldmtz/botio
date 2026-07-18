import type { SupabaseClient } from '@supabase/supabase-js';
import { KALYO_TRIAL_MS } from '@/lib/kalyo-trial-plans';

export type EnrollTrialOnboardingInput = {
  customerPhone: string;
  trialUserEmail: string;
  trialUserName?: string | null;
  conversationId: string;
  trialStartedAt?: string;
  trialEndsAt?: string;
};

export async function enrollTrialOnboarding(
  supabase: SupabaseClient,
  input: EnrollTrialOnboardingInput,
): Promise<void> {
  const email = input.trialUserEmail.trim().toLowerCase();
  const phone = input.customerPhone.trim();
  if (!email || !phone) return;

  const startedAt = input.trialStartedAt ?? new Date().toISOString();
  const endsAt =
    input.trialEndsAt ?? new Date(new Date(startedAt).getTime() + KALYO_TRIAL_MS).toISOString();

  const { data: existing } = await supabase
    .from('trial_onboarding_messages')
    .select('id')
    .eq('trial_user_email', email)
    .is('upgraded_to_paid_at', null)
    .eq('unsubscribed', false)
    .gte('trial_ends_at', new Date().toISOString())
    .maybeSingle();

  if (existing) {
    console.log(`[trial-onboarding] skip enroll — active row exists | email=${email}`);
    return;
  }

  const { error } = await supabase.from('trial_onboarding_messages').insert({
    customer_phone: phone,
    trial_user_email: email,
    trial_user_name: input.trialUserName?.trim() || null,
    trial_started_at: startedAt,
    trial_ends_at: endsAt,
    conversation_id: input.conversationId,
  });

  if (error) {
    console.error('[trial-onboarding] enroll failed', { email, error });
    return;
  }

  console.log(`[trial-onboarding] enrolled | email=${email} | phone=${phone}`);
}

export async function markTrialUpgradedToPaid(
  supabase: SupabaseClient,
  trialUserEmail: string,
): Promise<number> {
  const email = trialUserEmail.trim().toLowerCase();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('trial_onboarding_messages')
    .update({ upgraded_to_paid_at: now })
    .eq('trial_user_email', email)
    .is('upgraded_to_paid_at', null)
    .select('id');

  if (error) {
    console.error('[trial-onboarding] mark paid failed', { email, error });
    throw error;
  }

  const count = data?.length ?? 0;
  if (count > 0) {
    console.log(`[trial-onboarding] upgraded to paid | email=${email} | rows=${count}`);
  }
  return count;
}
