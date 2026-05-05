import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateReply, type ChatMessage } from '@/lib/claude';
import { sendWhatsApp, emptyTwimlResponse } from '@/lib/twilio';
import { buildKalyoClaudeOptions } from '@/lib/kalyo-bot-options';
import { normalizePhone } from '@/lib/phone';

const HUMAN_ESCALATION_RE =
  /human[oa]|asesor[a]?|(?:hablar|habla|quiero)\s+con\s+(?:alguien|una?\s+persona)|persona\b|agente\b|equipo\s+de\s+ventas|\bventas\b|soporte\b|contactar|contacto\s+directo/i;

function detectHumanEscalation(text: string): boolean {
  return HUMAN_ESCALATION_RE.test(text);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HISTORY_LIMIT = 20;
const FALLBACK_MESSAGE = "Sorry, I'm having trouble right now. Please try again in a moment.";

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
    .select('id')
    .single();

  if (convError || !conversation) {
    console.error('[webhook] failed to upsert conversation', convError);
    return new Response('Internal error', { status: 500 });
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

  // Generate the assistant reply. For the Kalyo bot on the Twilio channel,
  // this exposes the activate_pro_trial + notify_sales_team tools; all other
  // bots see no suffix and no tools.
  const { systemSuffix, options: claudeOptions } = buildKalyoClaudeOptions({
    channel: 'twilio',
    bot,
    senderFrom: from,
  });
  const systemPrompt = (bot.system_prompt ?? '') + systemSuffix;

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
