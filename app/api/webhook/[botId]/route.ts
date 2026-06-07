import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateReply, type ChatMessage } from '@/lib/claude';
import { sendWhatsApp, emptyTwimlResponse } from '@/lib/twilio';
import { buildKalyoClaudeOptions } from '@/lib/kalyo-bot-options';
import { normalizePhone } from '@/lib/phone';
import { transcribeAudio } from '@/lib/audio-transcription';
import {
  FAREWELL_NO_PROGRESS,
  QUICK_REPLY_OPTIONS,
  appendQuickReplyPrompt,
  mapQuickReplySelection,
} from '@/lib/kalyo-messages';
import { isAdPrefillMessage, isKalyoBotId, touchConversation } from '@/lib/conversation-utils';
import { checkCache } from '@/lib/response-cache';
import { selectModel } from '@/lib/model-router';

const HUMAN_ESCALATION_RE =
  /human[oa]|asesor[a]?|(?:hablar|habla|quiero)\s+con\s+(?:alguien|una?\s+persona)|persona\b|agente\b|equipo\s+de\s+ventas|\bventas\b|soporte\b|contactar|contacto\s+directo/i;

function detectHumanEscalation(text: string): boolean {
  return HUMAN_ESCALATION_RE.test(text);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HISTORY_LIMIT = 20;
const FALLBACK_MESSAGE = "Sorry, I'm having trouble right now. Please try again in a moment.";
const USER_MSG_LIMIT = 15;
const BOT_STDDEV_THRESHOLD_MS = 500;
const BOT_MIN_SAMPLES = 5;
const TRANSCRIPTION_FAIL_MESSAGE =
  'No pude transcribir tu audio, ¿podrías escribírmelo o intentarlo de nuevo? 🙏';
const UNSUPPORTED_MEDIA_MESSAGE =
  'Por ahora solo puedo procesar audio o texto. ¿Me lo escribes o me mandas audio? 🙏';

const PROFESSION_RE =
  /pacientes?|consulta|sesi[oó]n|psic[oó]log|terapeuta|cl[ií]nica|ansiedad|depresi[oó]n|terapia/i;

type BotCredentials = {
  id: string;
  system_prompt: string | null;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_whatsapp_number: string | null;
  is_active: boolean;
};

type UserMessageMeta = {
  source: 'text' | 'audio';
  metadata: Record<string, unknown>;
  audioDurationSeconds?: number;
};

async function sendFarewellAndClose(
  supabase: ReturnType<typeof createAdminClient>,
  bot: BotCredentials,
  to: string,
  conversationId: string,
  closeReason: string,
): Promise<void> {
  await Promise.allSettled([
    bot.twilio_account_sid && bot.twilio_auth_token && bot.twilio_whatsapp_number
      ? sendWhatsApp({
          accountSid: bot.twilio_account_sid,
          authToken: bot.twilio_auth_token,
          from: bot.twilio_whatsapp_number,
          to,
          body: FAREWELL_NO_PROGRESS,
        })
      : Promise.resolve(),
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
  console.log('[webhook] conversation closed', { conversationId, closeReason });
}

async function sendDirectReply(bot: BotCredentials, to: string, body: string): Promise<Response> {
  if (bot.twilio_account_sid && bot.twilio_auth_token && bot.twilio_whatsapp_number) {
    try {
      await sendWhatsApp({
        accountSid: bot.twilio_account_sid,
        authToken: bot.twilio_auth_token,
        from: bot.twilio_whatsapp_number,
        to,
        body,
      });
    } catch (error) {
      console.error('[webhook] Twilio send failed', error);
    }
  }
  return emptyTwimlResponse();
}

async function resolveIncomingMessage(
  bot: BotCredentials,
  rawBody: string,
  numMedia: number,
  mediaUrl0: string,
  mediaContentType0: string,
): Promise<{ ok: true; body: string; meta: UserMessageMeta } | { ok: false; reply: string }> {
  if (numMedia >= 1) {
    const isAudio = mediaContentType0.startsWith('audio/');

    if (!isAudio) {
      return { ok: false, reply: UNSUPPORTED_MEDIA_MESSAGE };
    }

    if (!bot.twilio_account_sid || !bot.twilio_auth_token) {
      console.error('[webhook] audio received but bot missing Twilio credentials');
      return { ok: false, reply: TRANSCRIPTION_FAIL_MESSAGE };
    }

    const transcription = await transcribeAudio(
      mediaUrl0,
      bot.twilio_account_sid,
      bot.twilio_auth_token,
    );

    if (!transcription.success || !transcription.text) {
      const reply =
        transcription.error === 'audio too large'
          ? 'Tu audio es muy largo para procesarlo. ¿Podrías mandar uno más corto o escribirme el mensaje? 🙏'
          : TRANSCRIPTION_FAIL_MESSAGE;
      return { ok: false, reply };
    }

    return {
      ok: true,
      body: transcription.text,
      meta: {
        source: 'audio',
        audioDurationSeconds: transcription.durationSeconds,
        metadata: {
          source: 'audio',
          original_audio_url: mediaUrl0,
          duration_seconds: transcription.durationSeconds ?? null,
          transcription_latency_ms: transcription.transcriptionLatencyMs ?? null,
        },
      },
    };
  }

  const body = rawBody.trim();
  if (!body) {
    return { ok: false, reply: UNSUPPORTED_MEDIA_MESSAGE };
  }

  return {
    ok: true,
    body,
    meta: { source: 'text', metadata: {} },
  };
}

type Params = { params: { botId: string } };

export async function POST(request: Request, { params }: Params) {
  const webhookStartedAt = Date.now();
  const { botId } = params;

  let from: string;
  let rawBody: string;
  let numMedia = 0;
  let mediaUrl0 = '';
  let mediaContentType0 = '';

  try {
    const form = await request.formData();
    const rawFrom = String(form.get('From') ?? '');
    from = normalizePhone(rawFrom) ?? rawFrom;
    rawBody = String(form.get('Body') ?? '');
    numMedia = parseInt(String(form.get('NumMedia') ?? '0'), 10) || 0;
    mediaUrl0 = String(form.get('MediaUrl0') ?? '');
    mediaContentType0 = String(form.get('MediaContentType0') ?? '');

    if (!from) {
      return new Response('Missing From', { status: 400 });
    }
  } catch {
    return new Response('Invalid form body', { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: bot, error: botError } = await supabase
    .from('bots')
    .select(
      'id, system_prompt, twilio_account_sid, twilio_auth_token, twilio_whatsapp_number, is_active',
    )
    .eq('id', botId)
    .maybeSingle();

  if (botError || !bot) {
    return new Response('Bot not found', { status: 404 });
  }
  if (!bot.is_active) {
    return new Response('Bot inactive', { status: 403 });
  }

  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .upsert({ bot_id: bot.id, customer_phone: from }, { onConflict: 'bot_id,customer_phone' })
    .select('id, is_closed, lead_captured')
    .single();

  if (convError || !conversation) {
    console.error('[webhook] failed to upsert conversation', convError);
    return new Response('Internal error', { status: 500 });
  }

  if ((conversation as { is_closed: boolean }).is_closed) {
    console.log('[webhook] conversation already closed, ignoring message', {
      conversationId: conversation.id,
    });
    return emptyTwimlResponse();
  }

  const incoming = await resolveIncomingMessage(
    bot as BotCredentials,
    rawBody,
    numMedia,
    mediaUrl0,
    mediaContentType0,
  );

  if (!incoming.ok) {
    return sendDirectReply(bot as BotCredentials, from, incoming.reply);
  }

  const messageBody = incoming.body;
  const userMeta = incoming.meta;
  const nowIso = new Date().toISOString();

  const { error: userMsgError } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role: 'user',
    content: messageBody,
    source: userMeta.source,
    metadata: userMeta.metadata,
  });
  if (userMsgError) {
    console.error('[webhook] failed to insert user message', userMsgError);
    return new Response('Internal error', { status: 500 });
  }
  await touchConversation(supabase, conversation.id, nowIso);

  const { data: historyRows, error: historyError } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  if (historyError) {
    console.error('[webhook] failed to load history', historyError);
    return new Response('Internal error', { status: 500 });
  }

  const history: ChatMessage[] = (historyRows ?? [])
    .slice()
    .reverse()
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  const leadCaptured = (conversation as { lead_captured: boolean }).lead_captured;

  const { count: userMsgCount, error: countError } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversation.id)
    .eq('role', 'user');

  if (countError) {
    console.error('[webhook] failed to count user messages — guards 1/3 will be skipped', countError);
  }
  const totalUserMsgs = userMsgCount ?? 0;

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
    const variance = deltas.reduce((s, d) => s + Math.pow(d - mean, 2), 0) / deltas.length;
    const stdDev = Math.sqrt(variance);
    console.log('[webhook] bot-timing-check', {
      samples: userTimestamps.length,
      stdDevMs: Math.round(stdDev),
      meanMs: Math.round(mean),
    });
    if (stdDev < BOT_STDDEV_THRESHOLD_MS) {
      console.warn('[webhook] suspected_bot — closing conversation', { from, stdDevMs: Math.round(stdDev) });
      await sendFarewellAndClose(supabase, bot, from, conversation.id, 'suspected_bot');
      return emptyTwimlResponse();
    }
  }

  if (totalUserMsgs > USER_MSG_LIMIT && !leadCaptured) {
    console.warn('[webhook] no_lead_limit — closing conversation', { from, totalUserMsgs });
    await sendFarewellAndClose(supabase, bot, from, conversation.id, 'no_lead_limit');
    return emptyTwimlResponse();
  }

  const { systemSuffix, options: claudeOptions } = buildKalyoClaudeOptions({
    channel: 'twilio',
    bot,
    senderFrom: from,
    conversationId: conversation.id,
  });
  let systemPrompt = (bot.system_prompt ?? '') + systemSuffix;

  if (
    userMeta.source === 'audio' &&
    userMeta.audioDurationSeconds !== undefined &&
    userMeta.audioDurationSeconds > 15
  ) {
    systemPrompt +=
      `\n\n[INSTRUCCIÓN INMEDIATA] El último mensaje del usuario fue un audio largo (${userMeta.audioDurationSeconds}s). ` +
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
  console.log(
    '[webhook] last_message:',
    messageBody.slice(0, 120),
    '| source:',
    userMeta.source,
    '| escalation_detected:',
    escalationDetected,
  );

  let replyText: string;
  let hadToolUse = false;
  let cachedHit = false;
  let modelUsed = 'cache';

  const cached =
    isKalyoBotId(bot.id) && userMeta.source === 'text'
      ? checkCache(messageBody, history)
      : null;

  if (cached) {
    console.log(`[cache] hit | pattern=${cached.pattern}`);
    replyText = cached.response;
    cachedHit = true;
  } else {
    console.log('[cache] miss');
    const { model, reason, complexity } = selectModel(messageBody, history);
    modelUsed = model;
    console.log(
      `[model-router] selected=${model} complexity=${complexity} reason="${reason}"`,
    );

    try {
      const result = await generateReply(systemPrompt, history, {
        ...claudeOptions,
        model,
      });
      replyText = result.text;
      hadToolUse = result.hadToolUse;
    } catch (error) {
      console.error('[webhook] Claude call failed', error);
      replyText = FALLBACK_MESSAGE;
      modelUsed = model;
    }
  }

  console.log('[webhook] reply_generated | had_tool_use:', hadToolUse, '| cached:', cachedHit);
  if (escalationDetected && !hadToolUse) {
    console.warn('[escalation-warning] User requested human but Claude did not call notify_sales_team', {
      from,
      messageBody: messageBody.slice(0, 120),
    });
  }

  const isFirstKalyoReply = totalUserMsgs === 1 && isKalyoBotId(bot.id);
  const outboundBody =
    cachedHit || !isFirstKalyoReply ? replyText : appendQuickReplyPrompt(replyText);
  const storedReply = outboundBody;

  const assistantNow = new Date().toISOString();
  const { error: assistantMsgError } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role: 'assistant',
    content: storedReply,
    source: 'text',
    source_type: cachedHit ? 'cache' : 'claude',
  });
  if (assistantMsgError) {
    console.error('[webhook] failed to insert assistant message', assistantMsgError);
  } else {
    await touchConversation(supabase, conversation.id, assistantNow);
  }

  if (bot.twilio_account_sid && bot.twilio_auth_token && bot.twilio_whatsapp_number) {
    try {
      await sendWhatsApp({
        accountSid: bot.twilio_account_sid,
        authToken: bot.twilio_auth_token,
        from: bot.twilio_whatsapp_number,
        to: from,
        body: outboundBody,
        quickReplies: isFirstKalyoReply ? [...QUICK_REPLY_OPTIONS] : undefined,
      });
    } catch (error) {
      console.error('[webhook] Twilio send failed', error);
    }
  } else {
    console.warn('[webhook] bot missing Twilio credentials — skipping outbound send');
  }

  const totalLatencyMs = Date.now() - webhookStartedAt;
  console.log(
    `[webhook-stats] cached=${cachedHit} model=${modelUsed} latency_ms=${totalLatencyMs}`,
  );

  return emptyTwimlResponse();
}
