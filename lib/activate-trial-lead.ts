import { createKalyoTrialAccount } from '@/lib/kalyo-account-creator';
import { enrollTrialFromKalyoWebhook } from '@/lib/trial-onboarding-webhook';
import { normalizePhoneForDB } from '@/lib/phone-validation';

export type ActivateTrialLeadResult =
  | {
      status: 'success';
      email: string;
      phone: string;
      trial_ends_at: string;
      reactivated: boolean;
      welcome_sent: boolean;
      temp_password?: string;
    }
  | {
      status: 'error';
      error: string;
      detail?: string;
    };

export async function activateTrialForLead(params: {
  email: string;
  fullName: string;
  phone: string;
  source: string;
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

  const enroll = await enrollTrialFromKalyoWebhook({
    email: account.email,
    name: fullName,
    phone,
    source: params.source,
    tempPassword: account.password,
  });

  const welcomeSent = enroll.success;

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
