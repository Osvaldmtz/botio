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
  const expiresAt = new Date(now.getTime() + TRIAL_MS);

  // Protect paying customers: never shorten a real sub that already runs
  // past the new 15-day window.
  if (profile.plan === 'professional' && profile.plan_expires_at) {
    const currentExpiry = new Date(profile.plan_expires_at);
    if (currentExpiry.getTime() > expiresAt.getTime()) {
      return {
        status: 'already_active',
        expires_at: profile.plan_expires_at as string,
      };
    }
  }

  // One-trial-per-account: if they had a trial in the past and are no longer
  // professional, they've already used their freebie.
  if (profile.trial_ends_at && profile.plan !== 'professional') {
    const trialEnd = new Date(profile.trial_ends_at as string);
    if (trialEnd.getTime() < now.getTime()) {
      return {
        status: 'already_used',
        trial_ended_at: profile.trial_ends_at as string,
      };
    }
  }

  const expiresAtIso = expiresAt.toISOString();

  const { error: updateError } = await supabase
    .from('psychologists')
    .update({
      plan: 'professional',
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
