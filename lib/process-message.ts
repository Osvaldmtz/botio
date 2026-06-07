import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateReply, type ChatMessage } from '@/lib/claude';
import { buildKalyoClaudeOptions } from '@/lib/kalyo-bot-options';
import {
  QUICK_REPLY_OPTIONS,
  appendQuickReplyPrompt,
  FAREWELL_NO_PROGRESS,
  mapQuickReplySelection,
} from '@/lib/kalyo-messages';
import { isAdPrefillMessage, isKalyoBotId, touchConversation } from '@/lib/conversation-utils';
import { enrichAndNotifyLead, type ConversationMessage } from '@/lib/lead-enrichment';
import { checkCache } from '@/lib/response-cache';
import { selectModel } from '@/lib/model-router';
import { checkRateLimit } from '@/lib/rate-limit';
import { maybeEnrichConversationOnHandoff } from '@/lib/handoff-enrichment';
import { clearManualPipelineOverride, maybeAutoAdvancePipeline } from '@/lib/pipeline-utils';
import {
  buildAbSystemPromptSuffix,
  ensureConversationAssignments,
  getFirstMessageOverride,
  recordOutcome,
  type AbAssignmentContext,
} from '@/lib/ab-testing';
import { buildCustomerPhone, type ConversationChannel } from '@/lib/channel-utils';

const HISTORY_LIMIT = 20;
const FALLBACK_MESSAGE =
  "Sorry, I'm having trouble right now. Please try again in a moment.";
const USER_MSG_LIMIT = 15;
const BOT_STDDEV_THRESHOLD_MS = 500;
const BOT_MIN_SAMPLES = 5;

const PROFESSION_RE =
  /pacientes?|consulta|sesi[oó]n|psic[oó]log|terapeuta|cl[ií]nica|ansiedad|depresi[oó]n|terapia/i;

const HUMAN_ESCALATION_RE =
  /human[oa]|asesor[a]?|(?:hablar|habla|quiero)\s+con\s+(?:alguien|una?\s+persona)|persona\b|agente\b|equipo\s+de\s+ventas|\bventas\b|soporte\b|contactar|contacto\s+directo/i;

export type MessageChannel = ConversationChannel;

export type ProcessMessageSource = 'cache' | 'claude' | 'human' | 'ab-test' | 'closed';

export type ProcessIncomingMessageInput = {
  supabase: SupabaseClient;
  botId: string;
  channel: MessageChannel;
  identifier: string;
  messageBody: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  userMessageSource?: 'text' | 'audio';
  audioDurationSeconds?: number;
};

type QuickReplyButton = { id: string; title: string };

export type ProcessIncomingMessageResult = {
  replyText: string | null;
  conversationId: string;
  source: ProcessMessageSource;
  storedReply?: string;
  quickReplies?: QuickReplyButton[];
  closed?: boolean;
  rateLimited?: boolean;
};

type BotRow = {
  id: string;
  system_prompt: string | null;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_whatsapp_number: string | null;
  is_active: boolean;
};

type ConversationRow = {
  id: string;
  is_closed: boolean;
  lead_captured: boolean;
  handoff_active: boolean;
  pipeline_stage: string | null;
  pipeline_stage_updated_by: string | null;
  customer_phone: string;
  last_message_at: string | null;
};

function detectHumanEscalation(text: string): boolean {
  return HUMAN_ESCALATION_RE.test(text);
}

async function closeConversation(
  supabase: SupabaseClient,
  conversationId: string,
  closeReason: string,
): Promise<void> {
  if (closeReason === 'no_lead_limit') {
    await recordOutcome(supabase, conversationId, 'dropped');
  }

  await Promise.allSettled([
    supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: FAREWELL_NO_PROGRESS,
      source: 'text',
    }),
    supabase
      .from('conversations')
      .update({
        is_closed: true,
        close_reason: closeReason,
        closed_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversationId),
  ]);
}

async function upsertConversation(
  supabase: SupabaseClient,
  botId: string,
  channel: MessageChannel,
  identifier: string,
  sessionId?: string,
): Promise<ConversationRow> {
  const customerPhone = buildCustomerPhone(channel, identifier);

  const { data, error } = await supabase
    .from('conversations')
    .upsert(
      {
        bot_id: botId,
        customer_phone: customerPhone,
        channel,
        ...(sessionId ? { session_id: sessionId } : {}),
      },
      { onConflict: 'bot_id,customer_phone' },
    )
    .select(
      'id, is_closed, lead_captured, handoff_active, pipeline_stage, pipeline_stage_updated_by, customer_phone, last_message_at',
    )
    .single();

  if (error || !data) throw error ?? new Error('Failed to upsert conversation');
  return data as ConversationRow;
}

export async function processIncomingMessage(
  input: ProcessIncomingMessageInput,
): Promise<ProcessIncomingMessageResult> {
  const {
    supabase,
    botId,
    channel,
    identifier,
    messageBody,
    sessionId,
    metadata = {},
    userMessageSource = 'text',
    audioDurationSeconds,
  } = input;

  const rateLimitCheck = await checkRateLimit(supabase, identifier, botId, null);
  if (!rateLimitCheck.allowed) {
    console.log(`[rate-limit] BLOCKING ${channel} | id=${identifier}`);
    return {
      replyText: null,
      conversationId: '',
      source: 'closed',
      rateLimited: true,
    };
  }

  const { data: bot, error: botError } = await supabase
    .from('bots')
    .select(
      'id, system_prompt, twilio_account_sid, twilio_auth_token, twilio_whatsapp_number, is_active',
    )
    .eq('id', botId)
    .maybeSingle();

  if (botError || !bot) {
    throw botError ?? new Error('Bot not found');
  }
  if (!bot.is_active) {
    throw new Error('Bot inactive');
  }

  const conversation = await upsertConversation(
    supabase,
    bot.id,
    channel,
    identifier,
    sessionId ?? (channel === 'webchat' ? identifier : undefined),
  );

  if (conversation.is_closed) {
    return {
      replyText: null,
      conversationId: conversation.id,
      source: 'closed',
      closed: true,
    };
  }

  const nowIso = new Date().toISOString();
  const handoffActive = Boolean(conversation.handoff_active);

  const { error: userMsgError } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role: 'user',
    content: messageBody,
    source: userMessageSource,
    ...(handoffActive ? { source_type: 'user' } : {}),
    metadata,
  });
  if (userMsgError) throw userMsgError;

  await touchConversation(supabase, conversation.id, nowIso);

  const { count: handoffUserCount } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversation.id)
    .eq('role', 'user');

  if (handoffActive) {
    await maybeEnrichConversationOnHandoff(
      supabase,
      bot.id,
      conversation.id,
      conversation.customer_phone,
    );
    await clearManualPipelineOverride(supabase, conversation.id);
    await maybeAutoAdvancePipeline(
      supabase,
      {
        id: conversation.id,
        pipeline_stage: conversation.pipeline_stage ?? 'new',
        lead_captured: conversation.lead_captured,
        customer_phone: conversation.customer_phone,
        last_message_at: nowIso,
        pipeline_stage_updated_by: null,
      },
      handoffUserCount ?? 1,
    );
    console.log(`[process-message] channel=${channel} | source=human | conv=${conversation.id}`);
    return {
      replyText: null,
      conversationId: conversation.id,
      source: 'human',
    };
  }

  const { data: historyRows, error: historyError } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  if (historyError) throw historyError;

  const history: ChatMessage[] = (historyRows ?? [])
    .slice()
    .reverse()
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  const conversationMessages: ConversationMessage[] = (historyRows ?? [])
    .slice()
    .reverse()
    .map((m) => ({
      role: m.role,
      content: m.content,
      created_at: (m as { created_at: string }).created_at,
    }));

  if (isKalyoBotId(bot.id)) {
    try {
      await enrichAndNotifyLead(supabase, {
        conversationId: conversation.id,
        phone: conversation.customer_phone,
        conversationMessages,
        email: typeof metadata.email === 'string' ? metadata.email : undefined,
        name: typeof metadata.name === 'string' ? metadata.name : undefined,
      });
    } catch (enrichErr) {
      console.error('[lead-enrichment] failed during message processing', enrichErr);
    }
  }

  const leadCaptured = conversation.lead_captured;

  const { count: userMsgCount, error: countError } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversation.id)
    .eq('role', 'user');

  if (countError) {
    console.error('[process-message] failed to count user messages', countError);
  }

  const totalUserMsgs = userMsgCount ?? 0;

  let abAssignments: AbAssignmentContext[] = [];
  if (isKalyoBotId(bot.id) && totalUserMsgs === 1) {
    try {
      abAssignments = await ensureConversationAssignments(
        supabase,
        bot.id,
        conversation.id,
        'first_message',
      );
    } catch (abErr) {
      console.error('[ab-testing] assignment failed', abErr);
    }
  } else if (isKalyoBotId(bot.id) && totalUserMsgs > 1) {
    console.log(
      `[ab-testing] skipping assignment — not first user message (count=${totalUserMsgs}) conv=${conversation.id}`,
    );
  }
  const isFirstUserMessage = totalUserMsgs === 1;
  const firstMessageOverride = isFirstUserMessage
    ? getFirstMessageOverride(abAssignments)
    : null;

  if (totalUserMsgs === 3) {
    await recordOutcome(supabase, conversation.id, 'engaged');
  }

  const userTimestamps = (historyRows ?? [])
    .filter((m) => m.role === 'user')
    .map((m) => new Date((m as { created_at: string }).created_at).getTime())
    .sort((a, b) => a - b);

  if (userTimestamps.length >= BOT_MIN_SAMPLES) {
    const deltas: number[] = [];
    for (let i = 1; i < userTimestamps.length; i++) {
      deltas.push(userTimestamps[i] - userTimestamps[i - 1]);
    }
    const mean = deltas.reduce((s, d) => s + d, 0) / deltas.length;
    const variance =
      deltas.reduce((s, d) => s + Math.pow(d - mean, 2), 0) / deltas.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev < BOT_STDDEV_THRESHOLD_MS) {
      await closeConversation(supabase, conversation.id, 'suspected_bot');
      return {
        replyText: FAREWELL_NO_PROGRESS,
        conversationId: conversation.id,
        source: 'closed',
        closed: true,
      };
    }
  }

  if (totalUserMsgs > USER_MSG_LIMIT && !leadCaptured) {
    await closeConversation(supabase, conversation.id, 'no_lead_limit');
    return {
      replyText: FAREWELL_NO_PROGRESS,
      conversationId: conversation.id,
      source: 'closed',
      closed: true,
    };
  }

  const { systemSuffix, options: claudeOptions } = buildKalyoClaudeOptions({
    channel: 'twilio',
    bot: bot as BotRow,
    senderFrom: conversation.customer_phone,
    conversationId: conversation.id,
    conversationMessages,
  });

  let systemPrompt =
    (bot.system_prompt ?? '') +
    systemSuffix +
    buildAbSystemPromptSuffix(abAssignments, isFirstUserMessage);

  if (
    userMessageSource === 'audio' &&
    audioDurationSeconds !== undefined &&
    audioDurationSeconds > 15
  ) {
    systemPrompt +=
      `\n\n[INSTRUCCIÓN INMEDIATA] El último mensaje del usuario fue un audio largo (${audioDurationSeconds}s). ` +
      'Puedes empezar tu respuesta con un breve acuse de recibo natural.';
  }

  const quickReplyHint = mapQuickReplySelection(messageBody);
  if (quickReplyHint) {
    systemPrompt += `\n\n[INSTRUCCIÓN INMEDIATA — ESTE TURNO ÚNICAMENTE] ${quickReplyHint}`;
  }

  if (totalUserMsgs === 1 && isKalyoBotId(bot.id) && isAdPrefillMessage(messageBody)) {
    systemPrompt +=
      '\n\n[INSTRUCCIÓN INMEDIATA — PRIMER MENSAJE DE CAMPAÑA] ' +
      'El usuario llegó desde un anuncio. Responde en máximo 3 oraciones. ' +
      'Confirma que Kalyo es para psicólogos y pregunta: "¿Ya evalúas pacientes de forma digital o todavía en papel?" ' +
      'NO menciones trial, precios ni planes en este mensaje.';
  }

  if (totalUserMsgs === 3 && !leadCaptured) {
    const userContents = (historyRows ?? [])
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join(' ');
    if (!PROFESSION_RE.test(userContents)) {
      systemPrompt +=
        '\n\n[INSTRUCCIÓN INMEDIATA — ESTE TURNO ÚNICAMENTE] ' +
        'En este mensaje DEBES preguntar directamente al usuario, sin texto adicional antes: ' +
        '"¿Eres psicólogo/a buscando una plataforma para tu práctica?"';
    }
  }

  const escalationDetected = detectHumanEscalation(messageBody);

  let replyText: string;
  let hadToolUse = false;
  let source: ProcessMessageSource = 'claude';

  const cached =
    isKalyoBotId(bot.id) && userMessageSource === 'text' && !firstMessageOverride
      ? checkCache(messageBody, history)
      : null;

  if (firstMessageOverride) {
    replyText = firstMessageOverride;
    source = 'ab-test';
  } else if (cached) {
    replyText = cached.response;
    source = 'cache';
  } else {
    const { model } = selectModel(messageBody, history);
    try {
      const result = await generateReply(systemPrompt, history, {
        ...claudeOptions,
        model,
      });
      replyText = result.text;
      hadToolUse = result.hadToolUse;
    } catch (error) {
      console.error('[process-message] Claude call failed', error);
      replyText = FALLBACK_MESSAGE;
    }
  }

  if (escalationDetected && !hadToolUse) {
    console.warn('[escalation-warning] User requested human but no notify_sales_team tool call', {
      identifier,
      channel,
    });
  }

  const isFirstKalyoReply = totalUserMsgs === 1 && isKalyoBotId(bot.id);
  const useQuickReplies = channel === 'whatsapp' && isFirstKalyoReply;
  const storedReply =
    source === 'cache' || !useQuickReplies ? replyText : appendQuickReplyPrompt(replyText);

  const assistantNow = new Date().toISOString();
  const { error: assistantMsgError } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role: 'assistant',
    content: storedReply,
    source: 'text',
    source_type: source === 'cache' ? 'cache' : source === 'ab-test' ? 'claude' : 'claude',
  });
  if (assistantMsgError) {
    console.error('[process-message] failed to insert assistant message', assistantMsgError);
  } else {
    await touchConversation(supabase, conversation.id, assistantNow);
  }

  const { data: freshConv } = await supabase
    .from('conversations')
    .select(
      'pipeline_stage, pipeline_stage_updated_by, lead_captured, customer_phone, last_message_at',
    )
    .eq('id', conversation.id)
    .maybeSingle();

  if (freshConv?.lead_captured && !leadCaptured) {
    await recordOutcome(supabase, conversation.id, 'lead_captured');
  }

  if (freshConv) {
    await clearManualPipelineOverride(supabase, conversation.id);
    await maybeAutoAdvancePipeline(
      supabase,
      {
        id: conversation.id,
        pipeline_stage: freshConv.pipeline_stage,
        lead_captured: freshConv.lead_captured,
        customer_phone: freshConv.customer_phone,
        last_message_at: freshConv.last_message_at,
        pipeline_stage_updated_by: null,
      },
      totalUserMsgs,
    );
  }

  console.log(`[process-message] channel=${channel} | source=${source} | conv=${conversation.id}`);

  return {
    replyText: storedReply,
    storedReply,
    conversationId: conversation.id,
    source,
    quickReplies: useQuickReplies ? [...QUICK_REPLY_OPTIONS] : undefined,
  };
}
