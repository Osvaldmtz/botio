import { createKalyoTrialAccount } from '@/lib/kalyo-account-creator';
import { getKalyoClient } from '@/lib/kalyo-supabase';
import {
  enrollTrialFromKalyoWebhook,
  sendTrialCredentialsWelcome,
} from '@/lib/trial-onboarding-webhook';
import { normalizePhoneForDB } from '@/lib/phone-validation';
import { createAdminClient } from '@/lib/supabase/admin';

export type ActivateTrialLeadResult =
  | {
      status: 'success';
      email: string;
      phone: string;
      trial_ends_at: string;
      reactivated: boolean;
      welcome_sent: boolean;
      temp_password: string;
    }
  | {
      status: 'error';
      error: string;
      detail?: string;
    };

async function verifyActiveKalyoTrial(email: string): Promise<boolean> {
  const supabase = getKalyoClient();
  const { data, error } = await supabase
    .from('psychologists')
    .select('trial_ends_at, plan_expires_at')
    .eq('email', email)
    .maybeSingle();

  if (error || !data) return false;
  const now = Date.now();
  const trialEnds = data.trial_ends_at
    ? new Date(data.trial_ends_at as string).getTime()
    : 0;
  const planExpires = data.plan_expires_at
    ? new Date(data.plan_expires_at as string).getTime()
    : 0;
  return trialEnds > now || planExpires > now;
}

export async function activateTrialForLead(params: {
  email: string;
  fullName: string;
  phone: string;
  source: string;
  trialPlan?: 'max' | 'pro';
}): Promise<ActivateTrialLeadResult> {
  const email = params.email.trim().toLowerCase();
  const fullName = params.fullName.trim();
  const phone = normalizePhoneForDB(params.phone.trim());

  if (!email || !fullName || !phone) {
    return { status: 'error', error: 'missing_fields' };
  }

  const account = await createKalyoTrialAccount({
    email,
    fullName,
    phone,
    trialPlan: params.trialPlan ?? 'max',
  });

  if (!account.success) {
    if (account.error === 'trial_already_used') {
      return { status: 'error', error: 'trial_already_used' };
    }
    if (account.error === 'email_exists') {
      return { status: 'error', error: 'email_exists', detail: account.error_detail };
    }
    return {
      status: 'error',
      error: account.error,
      detail: account.error_detail,
    };
  }

  if (!account.password?.trim()) {
    return {
      status: 'error',
      error: 'password_missing',
      detail: 'Trial account created without a temporary password',
    };
  }

  const trialActive = await verifyActiveKalyoTrial(account.email);
  if (!trialActive) {
    return {
      status: 'error',
      error: 'kalyo_verify_failed',
      detail: 'Kalyo trial was not active after account creation',
    };
  }

  const supabase = createAdminClient();
  const enroll = await enrollTrialFromKalyoWebhook({
    email: account.email,
    name: fullName,
    phone,
    source: params.source,
    tempPassword: account.password,
    trialPlan: params.trialPlan ?? 'max',
  });

  let welcomeSent = enroll.success;

  if (!welcomeSent) {
    const enrollReason =
      enroll.success === false && 'reason' in enroll ? enroll.reason : 'unknown';
    console.warn(
      `[activate-trial-lead] enroll failed (${enrollReason}), retrying welcome | email=${email}`,
    );
    const welcome = await sendTrialCredentialsWelcome({
      email: account.email,
      name: fullName,
      phone,
      tempPassword: account.password,
      trialPlan: params.trialPlan ?? 'max',
      supabase,
    });
    welcomeSent = welcome.success;
    if (!welcomeSent) {
      console.error(
        `[activate-trial-lead] welcome retry failed | email=${email} | reason=${welcome.reason ?? welcome.error ?? 'unknown'}`,
      );
    }
  }

  return {
    status: 'success',
    email: account.email,
    phone,
    trial_ends_at: account.trial_ends_at,
    reactivated: account.reactivated ?? false,
    welcome_sent: welcomeSent,
    temp_password: account.password,
  };
}
