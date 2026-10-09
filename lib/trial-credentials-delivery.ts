import type { SupabaseClient } from '@supabase/supabase-js';
import { KALYO_TRIAL_MS, type TrialPlanChoice } from '@/lib/kalyo-trial-plans';
import { ensureTrialTrackingConsistency } from '@/lib/trial-tracking-consistency';
import { buildTrialTempPasswordWelcomeText } from '@/lib/trial-credentials-welcome-text';
import {
  enrollTrialFromKalyoWebhook,
  sendTrialCredentialsWelcome,
} from '@/lib/trial-onboarding-webhook';

export { buildTrialTempPasswordWelcomeText } from '@/lib/trial-credentials-welcome-text';

export type DeliverTempPasswordResult = {
  welcome_sent: boolean;
  welcome_body: string;
  enroll_ok: boolean;
};

/**
 * Enroll + WhatsApp credentials in the same activation request as createUser.
 * Never relies on Claude copying bot_message for the password.
 */
export async function deliverTempPasswordAndTrackTrial(params: {
  supabase: SupabaseClient;
  conversationId: string;
  email: string;
  phone: string;
  name: string;
  trialEndsAt?: string;
  tempPassword: string;
  trialPlan?: TrialPlanChoice;
}): Promise<DeliverTempPasswordResult> {
  const email = params.email.trim().toLowerCase();
  const tempPassword = params.tempPassword.trim();
  const name = params.name.trim() || email.split('@')[0] || 'Doctor/a';
  const phone = params.phone.trim();
  const trialPlan = params.trialPlan ?? 'max';
  const trialEndsAt =
    params.trialEndsAt ??
    new Date(Date.now() + KALYO_TRIAL_MS).toISOString();

  if (!tempPassword) {
    throw new Error('tempPassword is required for credentials welcome');
  }

  const welcome_body = buildTrialTempPasswordWelcomeText({
    name,
    email,
    trialEndsAt,
    tempPassword,
    trialPlan,
  });

  const enroll = await enrollTrialFromKalyoWebhook(
    {
      email,
      name,
      phone,
      source: 'botio_whatsapp',
      tempPassword,
      trialPlan,
      trialStartedAt: new Date().toISOString(),
    },
    { supabase: params.supabase },
  );

  let welcome_sent = enroll.success;
  let enroll_ok = enroll.success;

  if (!welcome_sent) {
    const reason =
      enroll.success === false && 'reason' in enroll ? enroll.reason : 'unknown';
    console.warn(
      `[trial-credentials] enroll did not send welcome (${reason}); forcing credentials | email=${email}`,
    );

    const welcome = await sendTrialCredentialsWelcome({
      email,
      name,
      phone,
      tempPassword,
      trialPlan,
      trialEndsAt,
      supabase: params.supabase,
    });
    welcome_sent = welcome.success;

    if (welcome.success && params.conversationId) {
      const content = welcome.textBody ?? welcome_body;
      await params.supabase.from('messages').insert({
        conversation_id: params.conversationId,
        role: 'assistant',
        content,
        source: 'text',
        source_type: 'system',
        metadata: {
          source: 'trial_onboarding_welcome',
          delivery_method: welcome.method,
          twilio_sid: welcome.sid ?? null,
          credentials_guaranteed: true,
        },
      });
    } else if (!welcome.success) {
      console.error(
        `[trial-credentials] credentials welcome failed | email=${email} | reason=${welcome.reason ?? welcome.error ?? 'unknown'}`,
      );
    }
  }

  await ensureTrialTrackingConsistency(params.supabase, {
    conversationId: params.conversationId,
    email,
    phone,
    source: 'trial_enroll',
    trialEndsAt,
    trialUserName: name,
    recordAbOutcome: true,
  });

  return { welcome_sent, welcome_body, enroll_ok };
}
