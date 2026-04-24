import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

const TRIAL_DAYS = 15;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

let cached: SupabaseClient | null = null;

export function getKalyoClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.KALYO_SUPABASE_URL;
  const key = process.env.KALYO_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Missing KALYO_SUPABASE_URL or KALYO_SUPABASE_SERVICE_KEY');
  }
  cached = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export type ActivateProTrialResult =
  | { status: 'success'; expires_at: string }
  | { status: 'already_active'; expires_at: string }
  | { status: 'already_used'; trial_ended_at: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

export async function activateProTrial(rawEmail: string): Promise<ActivateProTrialResult> {
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

  // Snapshot the profile state once. The two fields that matter are:
  //   plan_expires_at — is there a currently-valid Pro subscription right now?
  //   trial_ends_at   — did this account ever have a trial that has now ended?
  // Note: `plan` alone is NOT reliable as the source of truth. Kalyo's backend
  // does not always flip `plan` back to 'free' when a trial expires, so a row
  // can have plan='professional' with plan_expires_at in the past. Use the
  // timestamps, not the enum, for gating decisions.
  const planExpiresAt = profile.plan_expires_at
    ? new Date(profile.plan_expires_at as string)
    : null;
  const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at as string) : null;

  // Use plan_expires_at as the source of truth regardless of the plan field,
  // because the trial sets plan='starter' and paid subscriptions set plan='professional'.
  const hasActivePlan = planExpiresAt !== null && planExpiresAt.getTime() > now.getTime();

  const hasUsedTrial = trialEndsAt !== null && trialEndsAt.getTime() < now.getTime();

  console.log('[kalyo] activateProTrial state', {
    email,
    plan: profile.plan,
    plan_expires_at: profile.plan_expires_at,
    trial_ends_at: profile.trial_ends_at,
    hasActivePlan,
    hasUsedTrial,
  });

  // Currently has an active Pro subscription (paid or trial in progress).
  // Don't extend or re-activate — tell them it's already active.
  if (hasActivePlan) {
    return {
      status: 'already_active',
      expires_at: profile.plan_expires_at as string,
    };
  }

  // Already consumed their one-time trial. trial_ends_at is the source of
  // truth — this fires whether or not Kalyo has flipped the plan column back.
  if (hasUsedTrial) {
    return {
      status: 'already_used',
      trial_ended_at: profile.trial_ends_at as string,
    };
  }

  const expiresAt = new Date(now.getTime() + TRIAL_MS);
  const expiresAtIso = expiresAt.toISOString();

  const { error: updateError } = await supabase
    .from('psychologists')
    .update({
      plan: 'starter',
      trial_ends_at: expiresAtIso,
      plan_expires_at: expiresAtIso,
    })
    .eq('id', profile.id);

  if (updateError) {
    console.error('[kalyo] update failed', updateError);
    return { status: 'error', message: updateError.message };
  }

  return { status: 'success', expires_at: expiresAtIso };
}
