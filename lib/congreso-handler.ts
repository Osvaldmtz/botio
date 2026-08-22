import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { detectCongreso } from '@/lib/congreso-detector';
import { CONGRESO_MESSAGES, getKalyoAppUrl } from '@/lib/congreso-messages';
import { getKalyoClient } from '@/lib/kalyo-supabase';
import { KALYO_TRIAL_PLAN_MAX } from '@/lib/kalyo-trial-plans';
import { normalizePhone } from '@/lib/phone';

export type CongresoFlowState =
  | { step: 'asking_name' }
  | { step: 'asking_email'; name: string };

export type CongresoConversationRow = {
  id: string;
  bot_id: string;
  customer_phone: string;
  handoff_active: boolean;
  is_ambassador: boolean | null;
  metadata?: Record<string, unknown> | null;
};

const EMAIL_RE = /^[\w.+-]+@[\w.-]+\.\w{2,}$/i;

const CONGRESO_FLOW_KEY = 'congreso_flow';

const CONGRESO_TRIAL_MS = 30 * 24 * 60 * 60 * 1000;

/** Alphabet excludes ambiguous 0/O/I/l for WhatsApp readability. */
export function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(10);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('');
}

function readFlowState(
  metadata: Record<string, unknown> | null | undefined,
): CongresoFlowState | null {
  const raw = metadata?.[CONGRESO_FLOW_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const step = (raw as { step?: unknown }).step;
  if (step === 'asking_name') return { step: 'asking_name' };
  if (step === 'asking_email') {
    const name = (raw as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim()) {
      return { step: 'asking_email', name: name.trim() };
    }
  }
  return null;
}

async function updateConversationMetadata(
  supabase: SupabaseClient,
  conversationId: string,
  current: Record<string, unknown>,
  nextFlow: CongresoFlowState | null,
): Promise<Record<string, unknown>> {
  const next = { ...current };
  if (nextFlow === null) {
    delete next[CONGRESO_FLOW_KEY];
  } else {
    next[CONGRESO_FLOW_KEY] = nextFlow;
  }

  const { error } = await supabase
    .from('conversations')
    .update({ metadata: next })
    .eq('id', conversationId);

  if (error) throw error;
  return next;
}

async function hasActiveCongresoTrial(
  supabase: SupabaseClient,
  customerPhone: string,
  botId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('congreso_trials')
    .select('id')
    .eq('customer_phone', customerPhone)
    .eq('bot_id', botId)
    .maybeSingle();

  if (error) {
    console.error('[congreso] trial lookup failed', error);
    throw error;
  }

  return Boolean(data);
}

function isAlreadyRegisteredError(message: string): boolean {
  return /already\s+(been\s+)?registered|user already|already exists|email.*exist/i.test(
    message,
  );
}

async function activateCongresoMaxPlan(
  kalyo: SupabaseClient,
  email: string,
  expiresAtIso: string,
): Promise<void> {
  const { error } = await kalyo
    .from('psychologists')
    .update({
      plan: KALYO_TRIAL_PLAN_MAX,
      trial_ends_at: expiresAtIso,
      plan_expires_at: expiresAtIso,
    })
    .eq('email', email);

  if (error) {
    console.error('[congreso] plan activation failed', error);
  }
}

/**
 * Creates (or reuses) Kalyo Auth user and returns the password to share via WhatsApp.
 * Never throws — activation must continue even if Auth fails.
 */
async function ensureCongresoAuthAccount(params: {
  email: string;
  name: string;
  phone: string;
  expiresAtIso: string;
}): Promise<{ password: string; accountCreatedAt: string | null }> {
  const password = generatePassword();
  const nowIso = new Date().toISOString();

  let kalyo: SupabaseClient;
  try {
    kalyo = getKalyoClient();
  } catch (err) {
    console.error('[congreso] Kalyo client unavailable', err);
    return { password, accountCreatedAt: null };
  }

  const { data: authData, error: authError } = await kalyo.auth.admin.createUser({
    email: params.email,
    password,
    email_confirm: true,
    user_metadata: {
      name: params.name,
      phone: params.phone,
      source: 'congreso',
      plan: 'max',
    },
  });

  if (authError) {
    if (isAlreadyRegisteredError(authError.message)) {
      console.log(
        `[congreso] auth user already registered | email=${params.email} — continuing`,
      );

      const { data: existing } = await kalyo
        .from('psychologists')
        .select('auth_id')
        .eq('email', params.email)
        .maybeSingle();

      if (existing?.auth_id) {
        const { error: pwError } = await kalyo.auth.admin.updateUserById(
          existing.auth_id as string,
          { password },
        );
        if (pwError) {
          console.error('[congreso] password reset failed', pwError);
        }
      }

      await activateCongresoMaxPlan(kalyo, params.email, params.expiresAtIso);
      return { password, accountCreatedAt: null };
    }

    console.error('[congreso] createUser failed — continuing anyway', authError);
    return { password, accountCreatedAt: null };
  }

  const userId = authData.user?.id;
  if (userId) {
    const { error: insertError } = await kalyo.from('psychologists').insert({
      auth_id: userId,
      email: params.email,
      full_name: params.name,
      phone: params.phone,
      terms_accepted_at: nowIso,
      default_session_type: 'in_person',
      voice_id: 'es-MX-DaliaNeural',
      plan: KALYO_TRIAL_PLAN_MAX,
      trial_ends_at: params.expiresAtIso,
      plan_expires_at: params.expiresAtIso,
    });

    if (insertError) {
      console.error('[congreso] psychologists insert failed', insertError);
      // Auth user exists; still try plan update in case row already present
      await activateCongresoMaxPlan(kalyo, params.email, params.expiresAtIso);
    }
  }

  return { password, accountCreatedAt: nowIso };
}

/**
 * Congreso — Plan MAX 30 días gratis.
 * Returns reply text when intercepted; null when the message should continue
 * through the normal process-message chain.
 */
export async function handleCongresoFlow(
  message: string,
  conversation: CongresoConversationRow,
  supabase: SupabaseClient,
): Promise<string | null> {
  console.log('[Congreso] message recibido:', message);
  console.log('[Congreso] detectCongreso:', detectCongreso(message));

  if (conversation.handoff_active) return null;
  if (conversation.is_ambassador === true) return null;

  const metadata = (conversation.metadata as Record<string, unknown> | null) ?? {};
  const flow = readFlowState(metadata);
  const trimmed = message.trim();

  if (flow?.step === 'asking_name') {
    const name = trimmed;
    if (!name) {
      return CONGRESO_MESSAGES.askName;
    }
    await updateConversationMetadata(supabase, conversation.id, metadata, {
      step: 'asking_email',
      name,
    });
    return CONGRESO_MESSAGES.askEmail;
  }

  if (flow?.step === 'asking_email') {
    if (!EMAIL_RE.test(trimmed)) {
      return CONGRESO_MESSAGES.invalidEmail;
    }

    const email = trimmed.toLowerCase();
    const name = flow.name;
    const phone =
      normalizePhone(conversation.customer_phone) ?? conversation.customer_phone;

    await updateConversationMetadata(supabase, conversation.id, metadata, null);

    const activatedAt = new Date();
    const expiresAt = new Date(activatedAt.getTime() + CONGRESO_TRIAL_MS);
    const expiresAtIso = expiresAt.toISOString();
    const activatedAtIso = activatedAt.toISOString();

    const { password, accountCreatedAt } = await ensureCongresoAuthAccount({
      email,
      name,
      phone,
      expiresAtIso,
    });

    const { error: insertError } = await supabase.from('congreso_trials').insert({
      conversation_id: conversation.id,
      customer_phone: phone,
      name,
      email,
      bot_id: conversation.bot_id,
      activated_at: activatedAtIso,
      expires_at: expiresAtIso,
      generated_password: password,
      account_created_at: accountCreatedAt ?? activatedAtIso,
      day_1_sent_at: activatedAtIso,
    });

    if (insertError) {
      if (insertError.code === '23505') {
        return CONGRESO_MESSAGES.alreadyActive;
      }
      console.error('[congreso] insert trial failed', insertError);
      throw insertError;
    }

    console.log(
      `[congreso] activated | conv=${conversation.id} | phone=${phone} | email=${email}`,
    );

    return CONGRESO_MESSAGES.confirmed({
      name,
      email,
      password,
      url: getKalyoAppUrl(),
    });
  }

  if (!detectCongreso(message)) {
    return null;
  }

  const phone =
    normalizePhone(conversation.customer_phone) ?? conversation.customer_phone;

  if (await hasActiveCongresoTrial(supabase, phone, conversation.bot_id)) {
    return CONGRESO_MESSAGES.alreadyActive;
  }

  await updateConversationMetadata(supabase, conversation.id, metadata, {
    step: 'asking_name',
  });

  return `${CONGRESO_MESSAGES.welcome}\n\n${CONGRESO_MESSAGES.askName}`;
}
