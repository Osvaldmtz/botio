import type { SupabaseClient } from '@supabase/supabase-js';
import { isAmbassadorConversation, isAmbassadorFlowsEnabled } from '@/lib/ambassador-filters';
import { isValidPhone, normalizePhoneForDB } from '@/lib/phone-validation';
import { renderName } from '@/lib/render-name';
import { buildImmediateWelcomeMessage } from '@/lib/kalyo-trial-messages';
import { KALYO_TRIAL_MS, type TrialPlanChoice } from '@/lib/kalyo-trial-plans';
import { isTeamMember } from '@/lib/team-members';
import { markTrialActivatedByContact, findConversationIdsByEmail } from '@/lib/conversation-outcome';
import { emailToWebOnlyPhone, isWebOnlyPhone } from '@/lib/web-only-phone';
import { markDay1WelcomeSent } from '@/lib/trial-onboarding-cron';
import {
  notifyTrialEnrolled,
  type SendTelegramFn,
  type WelcomeMessageResult,
} from '@/lib/trial-onboarding-notifications';

const DEFAULT_KALYO_BOT_ID = '64f6eed2-1522-48fe-a2c6-f858b767df06';
const WELCOME_STATUS_DELAY_MS = 2000;

export type { WelcomeMessageResult } from '@/lib/trial-onboarding-notifications';

export type WelcomeMessageCreds = {
  accountSid: string;
  authToken: string;
  from: string;
};

export type WelcomeMessageTwilioFns = {
  sendTemplate: (args: {
    accountSid: string;
    authToken: string;
    from: string;
    to: string;
    contentSid: string;
    contentVariables: Record<string, string>;
  }) => Promise<{ sid: string }>;
  sendPlain: (args: {
    accountSid: string;
    authToken: string;
    from: string;
    to: string;
    body: string;
  }) => Promise<{ sid: string }>;
  fetchStatus: (args: {
    accountSid: string;
    authToken: string;
    sid: string;
  }) => Promise<{ status: string }>;
  sleep: (ms: number) => Promise<void>;
};

export type TrialOnboardingEnrollInput = {
  email: string;
  name: string;
  phone?: string;
  trialStartedAt?: string;
  source?: string;
  tempPassword?: string;
  trialPlan?: TrialPlanChoice;
};

export type TrialOnboardingEnrollSuccess = {
  success: true;
  trial_onboarding_id: string;
  conversation_id: string;
  trial_ends_at: string;
};

export type TrialOnboardingEnrollFailure = {
  success: false;
  reason: 'already_enrolled' | 'is_ambassador' | 'is_team_member';
};

export type TrialOnboardingEnrollResult =
  | TrialOnboardingEnrollSuccess
  | TrialOnboardingEnrollFailure;

export { buildImmediateWelcomeMessage };

function buildCredentialsFollowUp(email: string, tempPassword: string): string {
  return (
    `Tus datos de acceso a Kalyo:\n` +
    `📧 Email: ${email}\n` +
    `🔑 Contraseña temporal: ${tempPassword}\n` +
    `Entra en app.kalyo.io/login — puedes cambiar la contraseña después.`
  );
}

function defaultWelcomeTwilioFns(): WelcomeMessageTwilioFns {
  return {
    sendTemplate: async (args) => {
      const { sendWhatsAppMessage } = await import('@/lib/twilio');
      return sendWhatsAppMessage({
        accountSid: args.accountSid,
        authToken: args.authToken,
        from: args.from,
        to: args.to,
        contentSid: args.contentSid,
        contentVariables: args.contentVariables,
      });
    },
    sendPlain: async (args) => {
      const { sendWhatsAppMessage } = await import('@/lib/twilio');
      return sendWhatsAppMessage({
        accountSid: args.accountSid,
        authToken: args.authToken,
        from: args.from,
        to: args.to,
        body: args.body,
      });
    },
    fetchStatus: async (args) => {
      const { fetchTwilioMessageStatus } = await import('@/lib/twilio');
      const status = await fetchTwilioMessageStatus(
        args.accountSid,
        args.authToken,
        args.sid,
      );
      return { status: status.status };
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

function twilioErrorCode(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'number' ? code : null;
}

function isTemplateNotApprovedError(error: unknown): boolean {
  if (twilioErrorCode(error) === 63016) return true;
  if (error instanceof Error) {
    return error.message.toLowerCase().includes('approval');
  }
  return false;
}

function isUndeliveredStatus(status: string): boolean {
  return status === 'undelivered' || status === 'failed';
}

export async function sendWelcomeMessage(params: {
  to: string;
  name: string;
  creds: WelcomeMessageCreds;
  templateSid?: string | null;
  twilio?: WelcomeMessageTwilioFns;
  email?: string;
  tempPassword?: string;
  trialPlan?: TrialPlanChoice;
  trialEndsAt?: string;
}): Promise<WelcomeMessageResult> {
  const { to, name, creds } = params;
  const templateSid = params.templateSid ?? process.env.KALYO_WELCOME_TEMPLATE_SID;
  const twilio = params.twilio ?? defaultWelcomeTwilioFns();
  const displayName = renderName(name) || 'ahí';
  const welcomeOptions = {
    email: params.email,
    tempPassword: params.tempPassword,
    trialPlan: params.trialPlan ?? 'max',
    trialEndsAt: params.trialEndsAt,
  };

  const usePlainTextOnly = Boolean(params.email && params.tempPassword);

  if (templateSid && !usePlainTextOnly) {
    try {
      const result = await twilio.sendTemplate({
        accountSid: creds.accountSid,
        authToken: creds.authToken,
        from: creds.from,
        to,
        contentSid: templateSid,
        contentVariables: { '1': displayName },
      });

      await twilio.sleep(WELCOME_STATUS_DELAY_MS);
      const status = await twilio.fetchStatus({
        accountSid: creds.accountSid,
        authToken: creds.authToken,
        sid: result.sid,
      });

      if (isUndeliveredStatus(status.status)) {
        console.warn('[welcome-msg] template undelivered, falling back to plain text', {
          sid: result.sid,
          status: status.status,
        });
      } else {
        console.log('[welcome-msg] template sent', {
          sid: result.sid,
          status: status.status,
        });

        if (params.email && params.tempPassword) {
          try {
            const credResult = await twilio.sendPlain({
              accountSid: creds.accountSid,
              authToken: creds.authToken,
              from: creds.from,
              to,
              body: buildCredentialsFollowUp(params.email, params.tempPassword),
            });
            console.log('[welcome-msg] credentials follow-up sent', { sid: credResult.sid });
          } catch (credErr) {
            console.error('[welcome-msg] credentials follow-up failed', credErr);
          }
        }

        return { success: true, method: 'template', sid: result.sid };
      }
    } catch (error) {
      if (isTemplateNotApprovedError(error)) {
        console.warn(
          '[welcome-msg] template not yet approved by Meta, using plain text',
          error instanceof Error ? error.message : String(error),
        );
      } else {
        console.error('[welcome-msg] template error, falling back', error);
      }
    }
  }

  const textBody = buildImmediateWelcomeMessage(name, welcomeOptions);

  try {
    const result = await twilio.sendPlain({
      accountSid: creds.accountSid,
      authToken: creds.authToken,
      from: creds.from,
      to,
      body: textBody,
    });

    await twilio.sleep(WELCOME_STATUS_DELAY_MS);
    const status = await twilio.fetchStatus({
      accountSid: creds.accountSid,
      authToken: creds.authToken,
      sid: result.sid,
    });

    if (status.status === 'undelivered') {
      console.warn('[welcome-msg] plain text also undelivered (likely outside 24h window)', {
        sid: result.sid,
      });
      return {
        success: false,
        method: 'plain_text',
        sid: result.sid,
        reason: 'undelivered_outside_window',
      };
    }

    if (status.status === 'failed') {
      console.warn('[welcome-msg] plain text failed', { sid: result.sid });
      return {
        success: false,
        method: 'plain_text',
        sid: result.sid,
        reason: 'failed',
      };
    }

    console.log('[welcome-msg] plain text sent', {
      sid: result.sid,
      status: status.status,
    });
    return { success: true, method: 'plain_text', sid: result.sid };
  } catch (error) {
    console.error('[welcome-msg] complete failure', error);
    return {
      success: false,
      method: 'none',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function loadKalyoTwilioCreds(
  supabase: SupabaseClient,
): Promise<{ accountSid: string; authToken: string; from: string } | null> {
  const botId = process.env.KALYO_BOT_ID ?? DEFAULT_KALYO_BOT_ID;
  const { data: bot, error } = await supabase
    .from('bots')
    .select('twilio_account_sid, twilio_auth_token, twilio_whatsapp_number')
    .eq('id', botId)
    .maybeSingle();

  if (error || !bot) {
    console.error('[trial-onboarding-webhook] failed to load Kalyo bot creds', error);
    return null;
  }

  const accountSid = bot.twilio_account_sid ?? process.env.TWILIO_ACCOUNT_SID;
  const authToken = bot.twilio_auth_token ?? process.env.TWILIO_AUTH_TOKEN;
  const from = bot.twilio_whatsapp_number ?? process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
}

async function createKalyoConversation(
  supabase: SupabaseClient,
  params: {
    phone: string;
    email: string;
    name: string;
    source: string;
  },
): Promise<string> {
  const botId = process.env.KALYO_BOT_ID ?? DEFAULT_KALYO_BOT_ID;

  const byEmail = await findConversationIdsByEmail(supabase, params.email);
  if (byEmail.length > 0) {
    const existingId = byEmail[0];
    const { data: existing } = await supabase
      .from('conversations')
      .select('id, pipeline_stage, is_ambassador, metadata')
      .eq('id', existingId)
      .maybeSingle();

    if (existing?.id) {
      if (
        isAmbassadorConversation({
          is_ambassador: existing.is_ambassador,
          metadata: existing.metadata as Record<string, unknown> | null,
        })
      ) {
        throw new Error('is_ambassador');
      }

      await supabase
        .from('conversations')
        .update({
          lead_score: 50,
          lead_temperature: 'warm',
          lead_intent: 'Trial activated',
          lead_signals: ['dio email', 'registró trial via Kalyo'],
          lead_captured: true,
          metadata: {
            ...((existing.metadata as Record<string, unknown> | null) ?? {}),
            source: params.source,
            customer_email: params.email,
            customer_name: params.name,
          },
          last_message_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      try {
        const { setPipelineStageTrial } = await import('@/lib/pipeline-utils');
        await setPipelineStageTrial(supabase, existing.id as string, existing.pipeline_stage ?? null);
      } catch (err) {
        console.error('[trial-onboarding-webhook] pipeline stage update failed', err);
      }

      return existing.id as string;
    }
  }

  const { data: existing } = await supabase
    .from('conversations')
    .select('id, pipeline_stage, is_ambassador, metadata')
    .eq('bot_id', botId)
    .eq('customer_phone', params.phone)
    .maybeSingle();

  if (existing?.id) {
    if (
      isAmbassadorConversation({
        is_ambassador: existing.is_ambassador,
        metadata: existing.metadata as Record<string, unknown> | null,
      })
    ) {
      console.log(
        `[trial-onboarding] skip enroll | reason=is_ambassador | conv=${existing.id} | phone=${params.phone}`,
      );
      throw new Error('is_ambassador');
    }

    await supabase
      .from('conversations')
      .update({
        lead_score: 50,
        lead_temperature: 'warm',
        lead_intent: 'Trial activated',
        lead_signals: ['dio email', 'registró trial via Kalyo'],
        lead_captured: true,
        metadata: {
          source: params.source,
          customer_email: params.email,
          customer_name: params.name,
        },
        last_message_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    try {
      const { setPipelineStageTrial } = await import('@/lib/pipeline-utils');
      await setPipelineStageTrial(supabase, existing.id, existing.pipeline_stage ?? null);
    } catch (err) {
      console.error('[trial-onboarding-webhook] pipeline stage update failed', err);
    }

    return existing.id as string;
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      bot_id: botId,
      customer_phone: params.phone,
      channel: 'whatsapp',
      lead_score: 50,
      lead_temperature: 'warm',
      lead_intent: 'Trial activated',
      lead_signals: ['dio email', 'registró trial via Kalyo'],
      lead_captured: true,
      metadata: {
        source: params.source,
        customer_email: params.email,
        customer_name: params.name,
        status: 'open',
      },
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create conversation');
  }

  try {
    const { setPipelineStageTrial } = await import('@/lib/pipeline-utils');
    await setPipelineStageTrial(supabase, data.id as string, null);
  } catch (err) {
    console.error('[trial-onboarding-webhook] pipeline stage update failed', err);
  }

  return data.id as string;
}

async function resolveSupabaseClient(
  supabase?: SupabaseClient,
): Promise<SupabaseClient> {
  if (supabase) return supabase;
  const { createAdminClient } = await import('@/lib/supabase/admin');
  return createAdminClient();
}

export async function sendTrialCredentialsWelcome(params: {
  email: string;
  name: string;
  phone: string;
  tempPassword: string;
  trialPlan?: TrialPlanChoice;
  supabase?: SupabaseClient;
}): Promise<WelcomeMessageResult> {
  const supabase = await resolveSupabaseClient(params.supabase);
  const creds = await loadKalyoTwilioCreds(supabase);
  if (!creds) {
    return { success: false, method: 'none', reason: 'no_twilio_creds' };
  }

  return sendWelcomeMessage({
    to: normalizePhoneForDB(params.phone),
    name: params.name,
    creds,
    email: params.email.trim().toLowerCase(),
    tempPassword: params.tempPassword,
    trialPlan: params.trialPlan ?? 'max',
  });
}

export async function enrollTrialFromKalyoWebhook(
  input: TrialOnboardingEnrollInput,
  options?: {
    supabase?: SupabaseClient;
    sendTelegram?: SendTelegramFn;
    skipWhatsApp?: boolean;
  },
): Promise<TrialOnboardingEnrollResult> {
  const supabase = await resolveSupabaseClient(options?.supabase);
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const rawPhone = input.phone?.trim() ?? '';
  const phone = rawPhone ? normalizePhoneForDB(rawPhone) : emailToWebOnlyPhone(email);
  const source = input.source?.trim() || 'kalyo_web';

  console.log(
    `[trial-onboarding-webhook] received | email=${email} | phone=${phone} | web_only=${isWebOnlyPhone(phone)} | source=${source}`,
  );

  if (isAmbassadorFlowsEnabled() && !isWebOnlyPhone(phone)) {
    const { data: ambassadorByPhone } = await supabase
      .from('conversations')
      .select('id, is_ambassador, metadata')
      .eq('customer_phone', phone)
      .eq('is_ambassador', true)
      .maybeSingle();

    if (
      ambassadorByPhone &&
      isAmbassadorConversation({
        is_ambassador: ambassadorByPhone.is_ambassador,
        metadata: ambassadorByPhone.metadata as Record<string, unknown> | null,
      })
    ) {
      console.log(`[trial-onboarding] skip enroll | reason=is_ambassador | phone=${phone}`);
      return { success: false, reason: 'is_ambassador' };
    }
  }

  if (isTeamMember(email)) {
    console.log(`[trial-onboarding] skip enroll | reason=is_team_member | email=${email}`);
    return { success: false, reason: 'is_team_member' };
  }

  const startedAt = input.trialStartedAt ?? new Date().toISOString();
  const endsAt = new Date(new Date(startedAt).getTime() + KALYO_TRIAL_MS).toISOString();

  const { data: existing } = await supabase
    .from('trial_onboarding_messages')
    .select('id')
    .eq('trial_user_email', email)
    .maybeSingle();

  if (existing) {
    console.log(`[trial-onboarding-webhook] skip duplicate | email=${email} | reason=already_enrolled (any record, including expired)`);
    return { success: false, reason: 'already_enrolled' };
  }

  let conversationId: string;
  try {
    conversationId = await createKalyoConversation(supabase, {
      phone,
      email,
      name,
      source,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'is_ambassador') {
      return { success: false, reason: 'is_ambassador' };
    }
    throw err;
  }

  const { data: row, error: insertError } = await supabase
    .from('trial_onboarding_messages')
    .insert({
      customer_phone: phone,
      trial_user_email: email,
      trial_user_name: name,
      trial_started_at: startedAt,
      trial_ends_at: endsAt,
      conversation_id: conversationId,
    })
    .select('id')
    .single();

  if (insertError || !row) {
    console.error('[trial-onboarding-webhook] error | message=insert failed', insertError);
    throw insertError ?? new Error('Failed to insert trial_onboarding_messages');
  }

  const creds = await loadKalyoTwilioCreds(supabase);
  let welcomeResult: WelcomeMessageResult | null = null;

  if (!options?.skipWhatsApp && creds && !isWebOnlyPhone(phone)) {
    welcomeResult = await sendWelcomeMessage({
      to: phone,
      name,
      creds,
      email,
      tempPassword: input.tempPassword,
      trialPlan: input.trialPlan ?? 'max',
      trialEndsAt: endsAt,
    });

    const welcomeStatus = welcomeResult.success ? 'sent' : 'failed';
    const { error: welcomeUpdateError } = await supabase
      .from('trial_onboarding_messages')
      .update({
        welcome_msg_status: welcomeStatus,
        welcome_msg_method: welcomeResult.method,
      })
      .eq('id', row.id);

    if (welcomeUpdateError) {
      console.error(
        '[trial-onboarding-webhook] welcome status update failed',
        welcomeUpdateError,
      );
    }

    if (welcomeResult.success) {
      const welcomeBody = buildImmediateWelcomeMessage(name, {
        email,
        tempPassword: input.tempPassword,
        trialPlan: input.trialPlan ?? 'max',
        trialEndsAt: endsAt,
      });
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: welcomeBody,
        source: 'text',
        source_type: 'claude',
        metadata: {
          source: 'trial_onboarding_welcome',
          delivery_method: welcomeResult.method,
          twilio_sid: welcomeResult.sid ?? null,
        },
      });
      await markDay1WelcomeSent(supabase, row.id);
    }
  }

  await notifyTrialEnrolled({
    name,
    email,
    phone,
    source,
    trialEndsAt: endsAt,
    welcomeResult,
    sendTelegram: options?.sendTelegram,
  });

  console.log(
    `[trial-onboarding-webhook] enrolled | id=${row.id} | trial_ends=${endsAt} | email=${email}`,
  );

  try {
    await markTrialActivatedByContact(supabase, {
      conversationId,
      email,
      phone,
    });
  } catch (outcomeErr) {
    console.error('[trial-onboarding-webhook] outcome mark failed', outcomeErr);
  }

  return {
    success: true,
    trial_onboarding_id: row.id as string,
    conversation_id: conversationId,
    trial_ends_at: endsAt,
  };
}

export function validateTrialEnrollBody(body: unknown):
  | { ok: true; data: TrialOnboardingEnrollInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid JSON body' };
  }

  const record = body as Record<string, unknown>;
  const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const phone = typeof record.phone === 'string' ? normalizePhoneForDB(record.phone.trim()) : '';
  const trialStartedAt =
    typeof record.trial_started_at === 'string' ? record.trial_started_at.trim() : undefined;
  const source = typeof record.source === 'string' ? record.source.trim() : undefined;
  const tempPassword =
    typeof record.temp_password === 'string' ? record.temp_password.trim() : undefined;
  const trialPlanRaw =
    typeof record.trial_plan === 'string' ? record.trial_plan.trim().toLowerCase() : '';
  const trialPlan = trialPlanRaw === 'pro' ? 'pro' : 'max';

  if (!email || !email.includes('@')) {
    return { ok: false, error: 'email is required' };
  }
  if (!name) {
    return { ok: false, error: 'name is required' };
  }
  if (phone && !isValidPhone(phone)) {
    return { ok: false, error: 'phone must be valid E.164 format' };
  }

  return {
    ok: true,
    data: {
      email,
      name,
      phone: phone || undefined,
      trialStartedAt,
      source,
      tempPassword: tempPassword || undefined,
      trialPlan,
    },
  };
}
