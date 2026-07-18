import type { SupabaseClient } from '@supabase/supabase-js';
import { isAmbassadorConversation } from '@/lib/ambassador-filters';
import { isValidPhone, normalizePhoneForDB } from '@/lib/phone-validation';
import { isTeamMember } from '@/lib/team-members';
import { markTrialActivatedByContact } from '@/lib/conversation-outcome';
import { markDay1WelcomeSent } from '@/lib/trial-onboarding-cron';
import { notifyTrialEnrolled } from '@/lib/trial-onboarding-notifications';
import { buildDirectEnrollmentWelcomeMessage } from '@/lib/kalyo-trial-messages';

export { buildDirectEnrollmentWelcomeMessage };

const DEFAULT_KALYO_BOT_ID = '64f6eed2-1522-48fe-a2c6-f858b767df06';

export type TrialEnrollDirectInput = {
  email: string;
  fullName: string;
  phone: string;
  trialStartedAt: string;
  trialEndsAt: string;
  isNewAccount: boolean;
  tempPassword?: string;
  source: string;
  trialPlan?: 'max' | 'pro';
};

export type TrialEnrollDirectSuccess = {
  ok: true;
  conversation_id: string;
  welcome_sid: string;
  welcome_status: string;
  enrollment_id: string;
};

export type TrialEnrollDirectError = {
  ok: false;
  error: string;
  step: 'validation' | 'conversation' | 'enrollment' | 'twilio';
};

export type TrialEnrollDirectResult = TrialEnrollDirectSuccess | TrialEnrollDirectError;

export type DirectWelcomeTwilioFns = {
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

function defaultTwilioFns(): DirectWelcomeTwilioFns {
  return {
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

export function normalizeEnrollPhone(raw: string): string {
  let phone = raw.trim();
  if (phone.toLowerCase().startsWith('whatsapp:')) {
    phone = phone.slice('whatsapp:'.length);
  }
  return normalizePhoneForDB(phone);
}


export function validateTrialEnrollDirectBody(
  body: unknown,
):
  | { ok: true; data: TrialEnrollDirectInput }
  | { ok: false; error: string; step: 'validation' } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid JSON body', step: 'validation' };
  }

  const record = body as Record<string, unknown>;
  const email =
    typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
  const fullName =
    typeof record.full_name === 'string'
      ? record.full_name.trim()
      : typeof record.name === 'string'
        ? record.name.trim()
        : '';
  const phone =
    typeof record.phone === 'string' ? normalizeEnrollPhone(record.phone) : '';
  const trialStartedAt =
    typeof record.trial_started_at === 'string' ? record.trial_started_at.trim() : '';
  const trialEndsAt =
    typeof record.trial_ends_at === 'string' ? record.trial_ends_at.trim() : '';
  const source =
    typeof record.source === 'string' && record.source.trim()
      ? record.source.trim()
      : 'kaly_admin';
  const isNewAccount = record.is_new_account === true;
  const isReactivation = record.is_new_account === false;
  const tempPassword =
    typeof record.temp_password === 'string' ? record.temp_password.trim() : undefined;
  const trialPlanRaw = typeof record.trial_plan === 'string' ? record.trial_plan.trim().toLowerCase() : '';
  const trialPlan = trialPlanRaw === 'pro' ? 'pro' : 'max';

  if (!email || !email.includes('@')) {
    return { ok: false, error: 'email is required', step: 'validation' };
  }
  if (!phone) {
    return { ok: false, error: 'phone is required', step: 'validation' };
  }
  if (!isValidPhone(phone)) {
    return {
      ok: false,
      error: 'phone must be valid E.164 format',
      step: 'validation',
    };
  }
  if (!trialStartedAt || Number.isNaN(Date.parse(trialStartedAt))) {
    return { ok: false, error: 'trial_started_at is required', step: 'validation' };
  }
  if (!trialEndsAt || Number.isNaN(Date.parse(trialEndsAt))) {
    return { ok: false, error: 'trial_ends_at is required', step: 'validation' };
  }
  if (!isNewAccount && !isReactivation) {
    return {
      ok: false,
      error: 'is_new_account is required (true or false)',
      step: 'validation',
    };
  }
  if (isNewAccount && !tempPassword) {
    return {
      ok: false,
      error: 'temp_password is required when is_new_account is true',
      step: 'validation',
    };
  }

  return {
    ok: true,
    data: {
      email,
      fullName,
      phone,
      trialStartedAt,
      trialEndsAt,
      isNewAccount,
      tempPassword: isNewAccount ? tempPassword : undefined,
      source,
      trialPlan,
    },
  };
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
    console.error('[trial-enroll-direct] failed to load Kalyo bot creds', error);
    return null;
  }

  const accountSid = bot.twilio_account_sid ?? process.env.TWILIO_ACCOUNT_SID;
  const authToken = bot.twilio_auth_token ?? process.env.TWILIO_AUTH_TOKEN;
  const from = bot.twilio_whatsapp_number ?? process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
}

async function upsertKalyoConversation(
  supabase: SupabaseClient,
  params: {
    phone: string;
    email: string;
    fullName: string;
    source: string;
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const botId = process.env.KALYO_BOT_ID ?? DEFAULT_KALYO_BOT_ID;

  const { data: existing, error: lookupError } = await supabase
    .from('conversations')
    .select('id, pipeline_stage, is_ambassador, metadata')
    .eq('bot_id', botId)
    .eq('customer_phone', params.phone)
    .maybeSingle();

  if (lookupError) {
    console.error('[trial-enroll-direct] conversation lookup failed', lookupError);
    return { ok: false, error: lookupError.message };
  }

  if (
    existing &&
    isAmbassadorConversation({
      is_ambassador: existing.is_ambassador,
      metadata: existing.metadata as Record<string, unknown> | null,
    })
  ) {
    return { ok: false, error: 'phone belongs to ambassador lead' };
  }

  const conversationPayload = {
    lead_score: 50,
    lead_temperature: 'warm' as const,
    lead_intent: 'Trial activated',
    lead_signals: ['dio email', 'registró trial via Kalyo'],
    lead_captured: true,
    metadata: {
      source: params.source,
      customer_email: params.email,
      customer_name: params.fullName,
      is_team_member: false,
      status: 'open',
    },
    last_message_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('conversations')
      .update(conversationPayload)
      .eq('id', existing.id);

    if (updateError) {
      console.error('[trial-enroll-direct] conversation update failed', updateError);
      return { ok: false, error: updateError.message };
    }

    try {
      const { setPipelineStageTrial } = await import('@/lib/pipeline-utils');
      await setPipelineStageTrial(supabase, existing.id, existing.pipeline_stage ?? null);
    } catch (err) {
      console.error('[trial-enroll-direct] pipeline stage update failed', err);
    }

    return { ok: true, id: existing.id as string };
  }

  const { data, error: insertError } = await supabase
    .from('conversations')
    .insert({
      bot_id: botId,
      customer_phone: params.phone,
      channel: 'whatsapp',
      ...conversationPayload,
    })
    .select('id')
    .single();

  if (insertError || !data) {
    console.error('[trial-enroll-direct] conversation insert failed', insertError);
    return { ok: false, error: insertError?.message ?? 'Failed to create conversation' };
  }

  try {
    const { setPipelineStageTrial } = await import('@/lib/pipeline-utils');
    await setPipelineStageTrial(supabase, data.id as string, null);
  } catch (err) {
    console.error('[trial-enroll-direct] pipeline stage update failed', err);
  }

  return { ok: true, id: data.id as string };
}

async function resolveSupabaseClient(
  supabase?: SupabaseClient,
): Promise<SupabaseClient> {
  if (supabase) return supabase;
  const { createAdminClient } = await import('@/lib/supabase/admin');
  return createAdminClient();
}

export async function sendDirectEnrollmentWelcome(params: {
  to: string;
  body: string;
  creds: { accountSid: string; authToken: string; from: string };
  twilio?: DirectWelcomeTwilioFns;
}): Promise<{ ok: true; sid: string; status: string } | { ok: false; error: string }> {
  const twilio = params.twilio ?? defaultTwilioFns();

  try {
    const result = await twilio.sendPlain({
      accountSid: params.creds.accountSid,
      authToken: params.creds.authToken,
      from: params.creds.from,
      to: params.to,
      body: params.body,
    });

    await twilio.sleep(2000);
    const status = await twilio.fetchStatus({
      accountSid: params.creds.accountSid,
      authToken: params.creds.authToken,
      sid: result.sid,
    });

    if (status.status === 'failed' || status.status === 'undelivered') {
      return {
        ok: false,
        error: `Twilio message ${status.status}`,
      };
    }

    return { ok: true, sid: result.sid, status: status.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[trial-enroll-direct] twilio send failed', error);
    return { ok: false, error: message };
  }
}

export async function enrollTrialDirect(
  input: TrialEnrollDirectInput,
  options?: {
    supabase?: SupabaseClient;
    twilio?: DirectWelcomeTwilioFns;
    skipWhatsApp?: boolean;
  },
): Promise<TrialEnrollDirectResult> {
  const supabase = await resolveSupabaseClient(options?.supabase);
  const email = input.email.trim().toLowerCase();
  const phone = normalizeEnrollPhone(input.phone);

  console.log(
    `[trial-enroll-direct] received | email=${email} | phone=${phone} | is_new=${input.isNewAccount} | source=${input.source}`,
  );

  if (isTeamMember(email)) {
    return { ok: false, error: 'team member email cannot enroll', step: 'validation' };
  }

  const conversation = await upsertKalyoConversation(supabase, {
    phone,
    email,
    fullName: input.fullName,
    source: input.source,
  });

  if (!conversation.ok) {
    return { ok: false, error: conversation.error, step: 'conversation' };
  }

  const conversationId = conversation.id;

  const { data: existingEnrollment } = await supabase
    .from('trial_onboarding_messages')
    .select('id')
    .eq('trial_user_email', email)
    .maybeSingle();

  let enrollmentId: string;

  if (existingEnrollment?.id) {
    const { data: updated, error: updateError } = await supabase
      .from('trial_onboarding_messages')
      .update({
        customer_phone: phone,
        trial_user_name: input.fullName || null,
        trial_started_at: input.trialStartedAt,
        trial_ends_at: input.trialEndsAt,
        conversation_id: conversationId,
        welcome_msg_status: 'pending',
        welcome_msg_method: null,
      })
      .eq('id', existingEnrollment.id)
      .select('id')
      .single();

    if (updateError || !updated) {
      console.error('[trial-enroll-direct] enrollment update failed', updateError);
      return {
        ok: false,
        error: updateError?.message ?? 'Failed to update enrollment',
        step: 'enrollment',
      };
    }

    enrollmentId = updated.id as string;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('trial_onboarding_messages')
      .insert({
        customer_phone: phone,
        trial_user_email: email,
        trial_user_name: input.fullName || null,
        trial_started_at: input.trialStartedAt,
        trial_ends_at: input.trialEndsAt,
        conversation_id: conversationId,
        welcome_msg_status: 'pending',
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error('[trial-enroll-direct] enrollment insert failed', insertError);
      return {
        ok: false,
        error: insertError?.message ?? 'Failed to insert enrollment',
        step: 'enrollment',
      };
    }

    enrollmentId = inserted.id as string;
  }

  const welcomeBody = buildDirectEnrollmentWelcomeMessage({
    fullName: input.fullName,
    email,
    trialEndsAt: input.trialEndsAt,
    isNewAccount: input.isNewAccount,
    tempPassword: input.tempPassword,
    trialPlan: input.trialPlan ?? 'max',
  });

  let welcomeSid = '';
  let welcomeStatus = 'skipped';

  if (!options?.skipWhatsApp) {
    const creds = await loadKalyoTwilioCreds(supabase);
    if (!creds) {
      await supabase
        .from('trial_onboarding_messages')
        .update({ welcome_msg_status: 'failed', welcome_msg_method: 'none' })
        .eq('id', enrollmentId);

      return {
        ok: false,
        error: 'Twilio credentials not configured',
        step: 'twilio',
      };
    }

    const sendResult = await sendDirectEnrollmentWelcome({
      to: phone,
      body: welcomeBody,
      creds,
      twilio: options?.twilio,
    });

    if (!sendResult.ok) {
      await supabase
        .from('trial_onboarding_messages')
        .update({ welcome_msg_status: 'failed', welcome_msg_method: 'plain_text' })
        .eq('id', enrollmentId);

      return { ok: false, error: sendResult.error, step: 'twilio' };
    }

    welcomeSid = sendResult.sid;
    welcomeStatus = sendResult.status;

    await supabase
      .from('trial_onboarding_messages')
      .update({
        welcome_msg_status: 'sent',
        welcome_msg_method: 'plain_text',
      })
      .eq('id', enrollmentId);
  }

  await supabase.from('messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: welcomeBody,
    source: 'text',
    source_type: 'system',
    metadata: {
      source: 'enrollment_direct',
      twilio_sid: welcomeSid || null,
      is_new_account: input.isNewAccount,
    },
  });

  if (welcomeStatus === 'sent' || options?.skipWhatsApp) {
    await markDay1WelcomeSent(supabase, enrollmentId);
  }

  await notifyTrialEnrolled({
    name: input.fullName,
    email,
    phone,
    source: input.source,
    trialEndsAt: input.trialEndsAt,
    welcomeResult: welcomeSid
      ? { success: true, method: 'plain_text', sid: welcomeSid }
      : null,
  });

  try {
    await markTrialActivatedByContact(supabase, {
      conversationId,
      email,
      phone,
    });
  } catch (outcomeErr) {
    console.error('[trial-enroll-direct] outcome mark failed', outcomeErr);
  }

  console.log(
    `[trial-enroll-direct] success | enrollment=${enrollmentId} | conv=${conversationId} | welcome_sid=${welcomeSid}`,
  );

  return {
    ok: true,
    conversation_id: conversationId,
    welcome_sid: welcomeSid,
    welcome_status: welcomeStatus,
    enrollment_id: enrollmentId,
  };
}
