import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidPhone, normalizePhoneForDB } from '@/lib/phone-validation';
import { renderName } from '@/lib/render-name';
import {
  notifyTrialEnrolled,
  type SendTelegramFn,
} from '@/lib/trial-onboarding-notifications';

const TRIAL_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
const DEFAULT_KALYO_BOT_ID = '64f6eed2-1522-48fe-a2c6-f858b767df06';

export type TrialOnboardingEnrollInput = {
  email: string;
  name: string;
  phone: string;
  trialStartedAt?: string;
  source?: string;
};

export type TrialOnboardingEnrollSuccess = {
  success: true;
  trial_onboarding_id: string;
  conversation_id: string;
  trial_ends_at: string;
};

export type TrialOnboardingEnrollFailure = {
  success: false;
  reason: 'already_enrolled';
};

export type TrialOnboardingEnrollResult =
  | TrialOnboardingEnrollSuccess
  | TrialOnboardingEnrollFailure;

function buildImmediateWelcomeMessage(name: string): string {
  const display = renderName(name) || 'ahí';
  return (
    `¡Hola ${display}! 👋 Soy Sofía, asistente de Kalyo.\n\n` +
    `Te activaste el trial Pro de 15 días. Aquí estaré para resolverte dudas o ayudarte durante este tiempo.\n\n` +
    `Tu primer paso: entra a https://app.kalyo.io/login y crea tu primer paciente.\n\n` +
    `¿Te queda alguna duda?`
  );
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

  const { data: existing } = await supabase
    .from('conversations')
    .select('id, pipeline_stage')
    .eq('bot_id', botId)
    .eq('customer_phone', params.phone)
    .maybeSingle();

  if (existing?.id) {
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
  const phone = normalizePhoneForDB(input.phone.trim());
  const source = input.source?.trim() || 'kalyo_web';

  console.log(
    `[trial-onboarding-webhook] received | email=${email} | phone=${phone} | source=${source}`,
  );

  const startedAt = input.trialStartedAt ?? new Date().toISOString();
  const endsAt = new Date(new Date(startedAt).getTime() + TRIAL_DAYS_MS).toISOString();

  const { data: existing } = await supabase
    .from('trial_onboarding_messages')
    .select('id')
    .eq('trial_user_email', email)
    .is('upgraded_to_paid_at', null)
    .eq('unsubscribed', false)
    .gte('trial_ends_at', new Date().toISOString())
    .maybeSingle();

  if (existing) {
    console.log(`[trial-onboarding-webhook] skip duplicate | email=${email}`);
    return { success: false, reason: 'already_enrolled' };
  }

  const conversationId = await createKalyoConversation(supabase, {
    phone,
    email,
    name,
    source,
  });

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

  const welcomeBody = buildImmediateWelcomeMessage(name);
  const creds = await loadKalyoTwilioCreds(supabase);

  if (!options?.skipWhatsApp && creds) {
    try {
      const { sendWhatsApp } = await import('@/lib/twilio');
      await sendWhatsApp({
        accountSid: creds.accountSid,
        authToken: creds.authToken,
        from: creds.from,
        to: phone,
        body: welcomeBody,
      });

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: welcomeBody,
        source: 'text',
        source_type: 'claude',
        metadata: { source: 'trial_onboarding_welcome' },
      });
    } catch (err) {
      console.error('[trial-onboarding-webhook] error | message=whatsapp send failed', err);
      throw err;
    }
  }

  await notifyTrialEnrolled({
    name,
    email,
    phone,
    source,
    trialEndsAt: endsAt,
    sendTelegram: options?.sendTelegram,
  });

  console.log(
    `[trial-onboarding-webhook] enrolled | id=${row.id} | trial_ends=${endsAt} | email=${email}`,
  );

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

  if (!email || !email.includes('@')) {
    return { ok: false, error: 'email is required' };
  }
  if (!name) {
    return { ok: false, error: 'name is required' };
  }
  if (!phone) {
    return { ok: false, error: 'phone is required' };
  }
  if (!isValidPhone(phone)) {
    return { ok: false, error: 'phone must be valid E.164 format' };
  }

  return {
    ok: true,
    data: { email, name, phone, trialStartedAt, source },
  };
}
