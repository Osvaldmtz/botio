import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateReply, type ChatMessage } from '@/lib/claude';
import { sendWhatsApp, emptyTwimlResponse } from '@/lib/twilio';
import { buildKalyoClaudeOptions } from '@/lib/kalyo-bot-options';
import { normalizePhone } from '@/lib/phone';
import { FAREWELL_NO_PROGRESS } from '@/lib/kalyo-messages';

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

const PROFESSION_RE =
  /pacientes?|consulta|sesi[oó]n|psic[oó]log|terapeuta|cl[ií]nica|ansiedad|depresi[oó]n|terapia/i;

type BotCredentials = {
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_whatsapp_number: string | null;
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
    }),
    supabase
      .from('conversations')
      .update({ is_closed: true, close_reason: closeReason, closed_at: new Date().toISOString() })
      .eq('id', conversationId),
  ]);
  console.log('[webhook] conversation closed', { conversationId, closeReason });
}

type Params = { params: { botId: string } };

export async function POST(request: Request, { params }: Params) {
  const { botId } = params;

  let from: string;
  let messageBody: string;
  try {
    const form = await request.formData();
    const rawFrom = String(form.get('From') ?? '');
    // Normalize to E.164 without the `whatsapp:` prefix and without the
    // post-dial `1` that old Twilio numbers carry for Mexican mobiles.
    from = normalizePhone(rawFrom) ?? rawFrom;
    messageBody = String(form.get('Body') ?? '');
    if (!from || !messageBody) {
      return new Response('Missing From or Body', { status: 400 });
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

  // Upsert conversation on (bot_id, customer_phone) unique constraint.
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .upsert({ bot_id: bot.id, customer_phone: from }, { onConflict: 'bot_id,customer_phone' })
    .select('id, is_closed, lead_captured')
    .single();

  if (convError || !conversation) {
    console.error('[webhook] failed to upsert conversation', convError);
    return new Response('Internal error', { status: 500 });
  }

  // Guard 0 — Conversation already closed by a previous guard.
  if ((conversation as { is_closed: boolean }).is_closed) {
    console.log('[webhook] conversation already closed, ignoring message', { conversationId: conversation.id });
    return emptyTwimlResponse();
  }

  // Persist the incoming user message.
  const { error: userMsgError } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role: 'user',
    content: messageBody,
  });
  if (userMsgError) {
    console.error('[webhook] failed to insert user message', userMsgError);
    return new Response('Internal error', { status: 500 });
  }

  // Load recent history (oldest → newest), including the message we just wrote.
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

  // Count total user messages in this conversation (separate query; historyRows is capped at 20).
  const { count: userMsgCount, error: countError } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversation.id)
    .eq('role', 'user');

  if (countError) {
    console.error('[webhook] failed to count user messages — guards 1/3 will be skipped', countError);
  }
  const totalUserMsgs = userMsgCount ?? 0;

  // Guard 2 — Bot timing heuristic: std dev of inter-message deltas < 500ms in 5+ user messages.
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

  // Guard 1 — Message limit: more than 15 user messages without a captured lead.
  if (totalUserMsgs > USER_MSG_LIMIT && !leadCaptured) {
    console.warn('[webhook] no_lead_limit — closing conversation', { from, totalUserMsgs });
    await sendFarewellAndClose(supabase, bot, from, conversation.id, 'no_lead_limit');
    return emptyTwimlResponse();
  }

  // Generate the assistant reply. For the Kalyo bot on the Twilio channel,
  // this exposes the activate_pro_trial + notify_sales_team tools; all other
  // bots see no suffix and no tools.
  const { systemSuffix, options: claudeOptions } = buildKalyoClaudeOptions({
    channel: 'twilio',
    bot,
    senderFrom: from,
    conversationId: conversation.id,
  });
  let systemPrompt = (bot.system_prompt ?? '') + systemSuffix;

  // Guard 3 — Profession injection: if this is the 3rd user message and no profession keywords
  // have appeared yet, force Sofía to ask the profession filter question in this turn.
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
  console.log('[webhook] last_message:', messageBody.slice(0, 120), '| escalation_detected:', escalationDetected);

  let replyText: string;
  let hadToolUse = false;
  try {
    const result = await generateReply(systemPrompt, history, claudeOptions);
    replyText = result.text;
    hadToolUse = result.hadToolUse;
  } catch (error) {
    console.error('[webhook] Claude call failed', error);
    replyText = FALLBACK_MESSAGE;
  }

  console.log('[webhook] reply_generated | had_tool_use:', hadToolUse);
  if (escalationDetected && !hadToolUse) {
    console.warn('[escalation-warning] User requested human but Claude did not call notify_sales_team', {
      from,
      messageBody: messageBody.slice(0, 120),
    });
  }

  // Persist the assistant reply (best effort — don't abort on failure).
  const { error: assistantMsgError } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role: 'assistant',
    content: replyText,
  });
  if (assistantMsgError) {
    console.error('[webhook] failed to insert assistant message', assistantMsgError);
  }

  // Send the reply via Twilio REST using the bot's stored credentials.
  if (bot.twilio_account_sid && bot.twilio_auth_token && bot.twilio_whatsapp_number) {
    try {
      await sendWhatsApp({
        accountSid: bot.twilio_account_sid,
        authToken: bot.twilio_auth_token,
        from: bot.twilio_whatsapp_number,
        to: from,
        body: replyText,
      });
    } catch (error) {
      console.error('[webhook] Twilio send failed', error);
    }
  } else {
    console.warn('[webhook] bot missing Twilio credentials — skipping outbound send');
  }

  return emptyTwimlResponse();
}
