import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isAdPrefillMessage } from '@/lib/conversation-utils';
import { normalizeStage } from '@/lib/pipeline';
import { getAppBaseUrl, getQstashClient } from '@/lib/qstash-client';
import { sendWhatsApp } from '@/lib/twilio';

const GHOST_MESSAGES: Record<number, string> = {
  1: 'Hola, ¿pudiste ver mi mensaje? 😊 Te tengo reservado el trial de 15 días por si te interesa.',
  2: 'El trial gratuito de Kalyo Pro sigue disponible para ti. ¿Te lo activo ahora?',
  3: 'Última oportunidad 🙂 Si en algún momento quieres probar Kalyo gratis, aquí estoy. ¡Que tengas excelentes sesiones!',
};

const GHOST_DELAYS_SECONDS: Record<number, number> = {
  1: 2 * 60 * 60,
  2: 24 * 60 * 60,
  3: 48 * 60 * 60,
};

const ELIGIBLE_STAGES = new Set(['new', 'in_conversation']);

type ScheduledGhostMessage = {
  step: number;
  messageId: string;
};

export type GhostReactivationMetadata = {
  scheduled?: ScheduledGhostMessage[];
  sent?: number[];
  cancelled_at?: string | null;
};

function readGhostMetadata(metadata: Record<string, unknown> | null): GhostReactivationMetadata {
  const raw = metadata?.ghost_reactivation;
  if (!raw || typeof raw !== 'object') return {};
  return raw as GhostReactivationMetadata;
}

async function loadFirstUserMessage(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('content')
    .eq('conversation_id', conversationId)
    .eq('role', 'user')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[ghost-reactivation] first user message lookup failed', error);
    return null;
  }

  return typeof data?.content === 'string' ? data.content : null;
}

async function countUserMessages(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('role', 'user');

  if (error) {
    console.error('[ghost-reactivation] user message count failed', error);
    return 0;
  }

  return count ?? 0;
}

async function loadBotTwilioCreds(
  supabase: SupabaseClient,
  botId: string,
): Promise<{
  accountSid: string;
  authToken: string;
  from: string;
} | null> {
  const { data, error } = await supabase
    .from('bots')
    .select('twilio_account_sid, twilio_auth_token, twilio_whatsapp_number')
    .eq('id', botId)
    .maybeSingle();

  if (error || !data) {
    console.error('[ghost-reactivation] bot creds lookup failed', error);
    return null;
  }

  const { twilio_account_sid, twilio_auth_token, twilio_whatsapp_number } = data;
  if (!twilio_account_sid || !twilio_auth_token || !twilio_whatsapp_number) {
    return null;
  }

  return {
    accountSid: twilio_account_sid as string,
    authToken: twilio_auth_token as string,
    from: twilio_whatsapp_number as string,
  };
}

export async function isGhostReactivationEligible(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ eligible: boolean; reason?: string }> {
  const { data: conv, error } = await supabase
    .from('conversations')
    .select(
      'id, pipeline_stage, is_closed, handoff_active, is_ambassador, metadata, customer_phone',
    )
    .eq('id', conversationId)
    .maybeSingle();

  if (error || !conv) {
    return { eligible: false, reason: 'conversation_not_found' };
  }

  if (conv.is_ambassador === true) {
    return { eligible: false, reason: 'ambassador' };
  }

  if (conv.is_closed) {
    return { eligible: false, reason: 'closed' };
  }

  if (conv.handoff_active) {
    return { eligible: false, reason: 'handoff_active' };
  }

  const stage = normalizeStage(conv.pipeline_stage);
  if (!ELIGIBLE_STAGES.has(stage)) {
    return { eligible: false, reason: `stage_${stage}` };
  }

  const ghostMeta = readGhostMetadata(
    (conv.metadata as Record<string, unknown> | null) ?? null,
  );
  if (ghostMeta.cancelled_at) {
    return { eligible: false, reason: 'cancelled' };
  }

  const userCount = await countUserMessages(supabase, conversationId);
  if (userCount !== 1) {
    return { eligible: false, reason: `user_messages_${userCount}` };
  }

  const firstUser = await loadFirstUserMessage(supabase, conversationId);
  if (!firstUser || !isAdPrefillMessage(firstUser)) {
    return { eligible: false, reason: 'not_ad_prefill' };
  }

  if (!conv.customer_phone?.trim()) {
    return { eligible: false, reason: 'missing_phone' };
  }

  return { eligible: true };
}

export async function scheduleGhostReactivationIfEligible(
  supabase: SupabaseClient,
  conversationId: string,
  botId: string,
): Promise<void> {
  const client = getQstashClient();
  if (!client) {
    console.log('[ghost-reactivation] skip schedule | reason: qstash_not_configured');
    return;
  }

  const { data: conv } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .maybeSingle();

  const metadata = (conv?.metadata as Record<string, unknown> | null) ?? {};
  const ghostMeta = readGhostMetadata(metadata);
  if (ghostMeta.scheduled?.length) {
    return;
  }
  if (ghostMeta.cancelled_at) {
    return;
  }

  const { eligible, reason } = await isGhostReactivationEligible(supabase, conversationId);
  if (!eligible) {
    console.log(
      `[ghost-reactivation] skip schedule | conv=${conversationId} | reason=${reason ?? 'unknown'}`,
    );
    return;
  }

  const callbackUrl = `${getAppBaseUrl()}/api/internal/ghost-reactivation`;
  const scheduled: ScheduledGhostMessage[] = [];

  for (const step of [1, 2, 3] as const) {
    try {
      const result = await client.publishJSON({
        url: callbackUrl,
        body: { conversationId, step, botId },
        delay: GHOST_DELAYS_SECONDS[step],
      });
      scheduled.push({ step, messageId: result.messageId });
    } catch (error) {
      console.error('[ghost-reactivation] qstash publish failed', {
        conversationId,
        step,
        error,
      });
      for (const entry of scheduled) {
        try {
          await client.messages.delete(entry.messageId);
        } catch {
          // best effort rollback
        }
      }
      return;
    }
  }

  await supabase
    .from('conversations')
    .update({
      metadata: {
        ...metadata,
        ghost_reactivation: {
          scheduled,
          sent: [],
          cancelled_at: null,
        },
      },
    })
    .eq('id', conversationId);

  console.log(
    `[ghost-reactivation] scheduled | conv=${conversationId} | steps=${scheduled.length}`,
  );
}

export async function cancelGhostReactivationIfActive(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<void> {
  const { data: conv } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .maybeSingle();

  const metadata = (conv?.metadata as Record<string, unknown> | null) ?? {};
  const ghostMeta = readGhostMetadata(metadata);
  const scheduled = ghostMeta.scheduled ?? [];

  if (!scheduled.length && !ghostMeta.cancelled_at) {
    return;
  }

  const client = getQstashClient();
  if (client) {
    for (const entry of scheduled) {
      try {
        await client.messages.delete(entry.messageId);
      } catch (error) {
        console.error('[ghost-reactivation] qstash delete failed', {
          conversationId,
          messageId: entry.messageId,
          error,
        });
      }
    }
  }

  await supabase
    .from('conversations')
    .update({
      metadata: {
        ...metadata,
        ghost_reactivation: {
          ...ghostMeta,
          scheduled: [],
          cancelled_at: new Date().toISOString(),
        },
      },
    })
    .eq('id', conversationId);

  console.log(`[ghost-reactivation] cancelled | conv=${conversationId}`);
}

export async function processGhostReactivationStep(
  supabase: SupabaseClient,
  conversationId: string,
  botId: string,
  step: number,
): Promise<{ sent: boolean; reason?: string }> {
  if (!GHOST_MESSAGES[step]) {
    return { sent: false, reason: 'invalid_step' };
  }

  const { eligible, reason } = await isGhostReactivationEligible(supabase, conversationId);
  if (!eligible) {
    return { sent: false, reason };
  }

  const { data: conv } = await supabase
    .from('conversations')
    .select('metadata, customer_phone')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conv?.customer_phone) {
    return { sent: false, reason: 'missing_phone' };
  }

  const metadata = (conv.metadata as Record<string, unknown> | null) ?? {};
  const ghostMeta = readGhostMetadata(metadata);
  const sentSteps = ghostMeta.sent ?? [];

  if (sentSteps.includes(step)) {
    return { sent: false, reason: 'already_sent' };
  }

  for (let prior = 1; prior < step; prior++) {
    if (!sentSteps.includes(prior)) {
      return { sent: false, reason: `waiting_prior_step_${prior}` };
    }
  }

  const creds = await loadBotTwilioCreds(supabase, botId);
  if (!creds) {
    return { sent: false, reason: 'missing_twilio_creds' };
  }

  const body = GHOST_MESSAGES[step];

  await sendWhatsApp({
    accountSid: creds.accountSid,
    authToken: creds.authToken,
    from: creds.from,
    to: conv.customer_phone,
    body,
  });

  const sentAt = new Date().toISOString();
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: body,
    source: 'text',
    source_type: 'claude',
    metadata: {
      source: 'ghost-reactivation',
      ghost_reactivation_step: step,
    },
  });

  await supabase
    .from('conversations')
    .update({
      last_message_at: sentAt,
      metadata: {
        ...metadata,
        ghost_reactivation: {
          ...ghostMeta,
          sent: [...sentSteps, step],
        },
      },
    })
    .eq('id', conversationId);

  console.log(`[ghost-reactivation] sent step=${step} | conv=${conversationId}`);

  return { sent: true };
}
