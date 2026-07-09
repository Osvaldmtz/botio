import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getKalyoClient } from '@/lib/kalyo-supabase';
import {
  KALYO_TRIAL_MS,
  resolveTrialDbPlan,
  trialPlanLabel,
  type TrialPlanChoice,
} from '@/lib/kalyo-trial-plans';

export { getKalyoClient };

export type ActivateTrialResult =
  | { status: 'success'; expires_at: string; trial_plan: TrialPlanChoice }
  | { status: 'already_active'; expires_at: string }
  | { status: 'already_used'; trial_ended_at: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

/** @deprecated Use ActivateTrialResult */
export type ActivateProTrialResult = ActivateTrialResult;

export async function activateTrial(
  rawEmail: string,
  trialPlan: TrialPlanChoice = 'max',
): Promise<ActivateTrialResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { status: 'error', message: 'Invalid email format' };
  }

  let supabase: SupabaseClient;
  try {
    supabase = getKalyoClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[kalyo] client init failed', error);
    return { status: 'error', message };
  }

  const { data: profile, error: findError } = await supabase
    .from('psychologists')
    .select('id, email, plan, plan_expires_at, trial_ends_at')
    .eq('email', email)
    .maybeSingle();

  if (findError) {
    console.error('[kalyo] lookup failed', findError);
    return { status: 'error', message: findError.message };
  }
  if (!profile) {
    return { status: 'not_found' };
  }

  const now = new Date();
  const planExpiresAt = profile.plan_expires_at
    ? new Date(profile.plan_expires_at as string)
    : null;
  const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at as string) : null;
  const hasActivePlan = planExpiresAt !== null && planExpiresAt.getTime() > now.getTime();
  const hasUsedTrial = trialEndsAt !== null && trialEndsAt.getTime() < now.getTime();

  console.log('[kalyo] activateTrial state', {
    email,
    trialPlan,
    plan: profile.plan,
    plan_expires_at: profile.plan_expires_at,
    trial_ends_at: profile.trial_ends_at,
    hasActivePlan,
    hasUsedTrial,
  });

  if (hasActivePlan) {
    return {
      status: 'already_active',
      expires_at: profile.plan_expires_at as string,
    };
  }

  if (hasUsedTrial) {
    return {
      status: 'already_used',
      trial_ended_at: profile.trial_ends_at as string,
    };
  }

  const expiresAt = new Date(now.getTime() + KALYO_TRIAL_MS);
  const expiresAtIso = expiresAt.toISOString();
  const dbPlan = resolveTrialDbPlan(trialPlan);

  const { error: updateError } = await supabase
    .from('psychologists')
    .update({
      plan: dbPlan,
      trial_ends_at: expiresAtIso,
      plan_expires_at: expiresAtIso,
    })
    .eq('id', profile.id);

  if (updateError) {
    console.error('[kalyo] update failed', updateError);
    return { status: 'error', message: updateError.message };
  }

  console.log(`[kalyo] trial activated | email=${email} | plan=${trialPlanLabel(trialPlan)} | db=${dbPlan}`);

  return { status: 'success', expires_at: expiresAtIso, trial_plan: trialPlan };
}

/** Default trial is Max. Pass `pro` only when lead explicitly requested Pro trial. */
export async function activateProTrial(
  rawEmail: string,
  trialPlan: TrialPlanChoice = 'max',
): Promise<ActivateTrialResult> {
  return activateTrial(rawEmail, trialPlan);
}
