import type { SupabaseClient } from '@supabase/supabase-js';
import { recordOutcome } from '@/lib/ab-testing';
import { markTrialActivatedByContact, type OutcomeSource } from '@/lib/conversation-outcome';
import { enrollTrialOnboarding } from '@/lib/trial-onboarding-enrollment';
import { setPipelineStageTrial } from '@/lib/pipeline-stage-mutations';
import { normalizeStage } from '@/lib/pipeline';

export type EnsureTrialTrackingInput = {
  conversationId: string;
  email: string;
  phone: string;
  source: OutcomeSource;
  trialEndsAt?: string;
  trialUserName?: string | null;
  /** When true, also records A/B outcome (trial_activated). */
  recordAbOutcome?: boolean;
};

export type EnsureTrialTrackingResult = {
  pipeline_updated: boolean;
  outcome_updated: boolean;
  onboarding_created: boolean;
  already_consistent: boolean;
};

export async function ensureTrialTrackingConsistency(
  supabase: SupabaseClient,
  input: EnsureTrialTrackingInput,
): Promise<EnsureTrialTrackingResult> {
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const result: EnsureTrialTrackingResult = {
    pipeline_updated: false,
    outcome_updated: false,
    onboarding_created: false,
    already_consistent: false,
  };

  if (!input.conversationId || !email || !phone) {
    return result;
  }

  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('id, pipeline_stage, outcome')
    .eq('id', input.conversationId)
    .maybeSingle();

  if (convErr || !conv) {
    console.error('[trial-tracking] conversation load failed', convErr);
    return result;
  }

  const stage = normalizeStage(conv.pipeline_stage as string | null);
  const needsPipeline = stage !== 'trial' && stage !== 'paid' && stage !== 'lost';
  const needsOutcome = !conv.outcome;

  const { data: onboardingByConv } = await supabase
    .from('trial_onboarding_messages')
    .select('id')
    .eq('conversation_id', input.conversationId)
    .maybeSingle();

  let hasOnboarding = Boolean(onboardingByConv);
  if (!hasOnboarding) {
    const { data: onboardingByEmail } = await supabase
      .from('trial_onboarding_messages')
      .select('id')
      .eq('trial_user_email', email)
      .is('upgraded_to_paid_at', null)
      .eq('unsubscribed', false)
      .gte('trial_ends_at', new Date().toISOString())
      .maybeSingle();
    hasOnboarding = Boolean(onboardingByEmail);
  }

  const needsOnboarding = !hasOnboarding;

  if (!needsPipeline && !needsOutcome && !needsOnboarding) {
    result.already_consistent = true;
    return result;
  }

  if (needsPipeline) {
    try {
      await setPipelineStageTrial(supabase, input.conversationId, conv.pipeline_stage as string);
      result.pipeline_updated = true;
    } catch (err) {
      console.error('[trial-tracking] pipeline stage update failed', err);
    }
  }

  if (needsOutcome) {
    const ok = await markTrialActivatedByContact(
      supabase,
      { conversationId: input.conversationId, email, phone },
      input.source,
    );
    result.outcome_updated = ok;
  }

  if (input.recordAbOutcome) {
    await recordOutcome(supabase, input.conversationId, 'trial_activated', { email });
  }

  if (needsOnboarding) {
    const before = await supabase
      .from('trial_onboarding_messages')
      .select('id')
      .eq('conversation_id', input.conversationId)
      .maybeSingle();

    await enrollTrialOnboarding(supabase, {
      customerPhone: phone,
      trialUserEmail: email,
      trialUserName: input.trialUserName,
      conversationId: input.conversationId,
      trialEndsAt: input.trialEndsAt,
    });

    const { data: after } = await supabase
      .from('trial_onboarding_messages')
      .select('id')
      .eq('conversation_id', input.conversationId)
      .maybeSingle();

    result.onboarding_created = !before.data && Boolean(after);
  }

  return result;
}
