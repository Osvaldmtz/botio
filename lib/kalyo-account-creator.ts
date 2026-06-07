import { getKalyoClient } from '@/lib/kalyo-supabase';

const TRIAL_DAYS = 15;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type CreateAccountResult =
  | {
      success: true;
      email: string;
      password?: string;
      user_id: string;
      trial_ends_at: string;
      reactivated?: boolean;
    }
  | {
      success: false;
      email: string;
      error: 'email_exists' | 'creation_failed' | 'trial_already_used' | 'invalid_email';
      error_detail?: string;
    };

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function generateKalyoPassword(): string {
  const year = new Date().getFullYear();
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += PASSWORD_CHARS[Math.floor(Math.random() * PASSWORD_CHARS.length)];
  }
  return `Kalyo-${year}-${suffix}`;
}

function hasActiveTrial(trialEndsAt: string | null, planExpiresAt: string | null): boolean {
  const now = Date.now();
  if (trialEndsAt && new Date(trialEndsAt).getTime() > now) return true;
  if (planExpiresAt && new Date(planExpiresAt).getTime() > now) return true;
  return false;
}

async function activateTrialForEmail(email: string): Promise<{ trial_ends_at: string } | null> {
  const supabase = getKalyoClient();
  const expiresAt = new Date(Date.now() + TRIAL_MS).toISOString();

  const { error } = await supabase
    .from('psychologists')
    .update({
      plan: 'starter',
      trial_ends_at: expiresAt,
      plan_expires_at: expiresAt,
    })
    .eq('email', email);

  if (error) {
    console.error('[account-creator] trial activation failed', error);
    return null;
  }

  return { trial_ends_at: expiresAt };
}

export async function createKalyoTrialAccount(input: {
  email: string;
  fullName: string;
  phone?: string;
  forceInsertFail?: boolean;
}): Promise<CreateAccountResult> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim() || email.split('@')[0];

  if (!isValidEmail(email)) {
    return { success: false, email, error: 'invalid_email', error_detail: 'Invalid email format' };
  }

  console.log(`[account-creator] creating user for email=${email}`);

  let supabase;
  try {
    supabase = getKalyoClient();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[account-creator] failed | error=client_init | detail=${detail}`);
    return { success: false, email, error: 'creation_failed', error_detail: detail };
  }

  const { data: existing, error: lookupError } = await supabase
    .from('psychologists')
    .select('id, auth_id, email, trial_ends_at, plan_expires_at')
    .eq('email', email)
    .maybeSingle();

  if (lookupError) {
    console.error(`[account-creator] failed | error=lookup | detail=${lookupError.message}`);
    return { success: false, email, error: 'creation_failed', error_detail: lookupError.message };
  }

  if (existing) {
    if (hasActiveTrial(existing.trial_ends_at, existing.plan_expires_at)) {
      console.log(`[account-creator] skipped | email=${email} | active trial`);
      return { success: false, email, error: 'trial_already_used' };
    }

    const activated = await activateTrialForEmail(email);
    if (!activated) {
      return {
        success: false,
        email,
        error: 'creation_failed',
        error_detail: 'Failed to reactivate trial',
      };
    }

    console.log(`[account-creator] success | email=${email} | trial_until=${activated.trial_ends_at} | reactivated=true`);
    return {
      success: true,
      email,
      user_id: existing.auth_id,
      trial_ends_at: activated.trial_ends_at,
      reactivated: true,
    };
  }

  const password = generateKalyoPassword();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, source: 'botio_whatsapp' },
  });

  if (authError || !authData.user) {
    const detail = authError?.message ?? 'createUser returned no user';
    if (/already|exists|registered/i.test(detail)) {
      return { success: false, email, error: 'email_exists', error_detail: detail };
    }
    console.error(`[account-creator] failed | error=createUser | detail=${detail}`);
    return { success: false, email, error: 'creation_failed', error_detail: detail };
  }

  const userId = authData.user.id;

  const insertPayload = input.forceInsertFail
    ? {
        auth_id: userId,
        email,
        full_name: fullName,
        phone: input.phone ?? null,
        terms_accepted_at: new Date().toISOString(),
        default_session_type: '__invalid__',
        voice_id: 'es-MX-DaliaNeural',
      }
    : {
        auth_id: userId,
        email,
        full_name: fullName,
        phone: input.phone ?? null,
        terms_accepted_at: new Date().toISOString(),
        default_session_type: 'in_person',
        voice_id: 'es-MX-DaliaNeural',
      };

  const { error: insertError } = await supabase.from('psychologists').insert(insertPayload);

  if (insertError) {
    console.error(`[account-creator] failed | error=psychologist_insert | detail=${insertError.message}`);
    await supabase.auth.admin.deleteUser(userId);
    return {
      success: false,
      email,
      error: 'creation_failed',
      error_detail: insertError.message,
    };
  }

  const activated = await activateTrialForEmail(email);
  if (!activated) {
    await supabase.from('psychologists').delete().eq('auth_id', userId);
    await supabase.auth.admin.deleteUser(userId);
    return {
      success: false,
      email,
      error: 'creation_failed',
      error_detail: 'Trial activation failed after account creation',
    };
  }

  console.log(`[account-creator] success | email=${email} | trial_until=${activated.trial_ends_at}`);

  return {
    success: true,
    email,
    password,
    user_id: userId,
    trial_ends_at: activated.trial_ends_at,
  };
}
