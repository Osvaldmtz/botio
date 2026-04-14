import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateReply, type ChatMessage } from '@/lib/claude';
import { sendMessengerMessage } from '@/lib/meta';
import { buildKalyoClaudeOptions } from '@/lib/kalyo-bot-options';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HISTORY_LIMIT = 20;
const FALLBACK_MESSAGE = "Sorry, I'm having trouble right now. Please try again in a moment.";

type Params = { params: { botId: string } };

// --------------------------------------------------------------------------
// GET — Meta webhook verification handshake
// Meta hits this URL once when subscribing the webhook. We validate the
// hub.verify_token against META_VERIFY_TOKEN and echo hub.challenge back as
// plain text. botId is part of the URL but not consulted here — the token
// alone authorizes verification, and each bot gets its own URL so ops can
// configure them independently on different Meta apps/pages.
// --------------------------------------------------------------------------
export async function GET(request: Request) {
  const expected = process.env.META_VERIFY_TOKEN;
  if (!expected) {
    console.error('[meta-webhook] META_VERIFY_TOKEN not configured');
    return new Response('Verify token not configured', { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === expected && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response('Forbidden', { status: 403 });
}

// --------------------------------------------------------------------------
// POST — inbound message processing
// --------------------------------------------------------------------------

type MetaMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
  };
};

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    messaging?: MetaMessagingEvent[];
  }>;
};

export async function POST(request: Request, { params }: Params) {
  const { botId } = params;

  let payload: MetaWebhookPayload;
  try {
    payload = (await request.json()) as MetaWebhookPayload;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!pageAccessToken) {
    console.error('[meta-webhook] META_PAGE_ACCESS_TOKEN not configured');
    // Return 200 so Meta does not retry — this is a config problem that
    // will not resolve by retrying.
    return Response.json({ received: true });
  }

  const supabase = createAdminClient();

  const { data: bot, error: botError } = await supabase
    .from('bots')
    .select('id, system_prompt, is_active')
    .eq('id', botId)
    .maybeSingle();

  if (botError || !bot) {
    console.error('[meta-webhook] bot not found', {
      botId,
      error: botError?.message,
    });
    return Response.json({ received: true });
  }
  if (!bot.is_active) {
    return Response.json({ received: true });
  }

  // Namespace the sender id so Messenger/Instagram PSIDs cannot collide with
  // E.164 phone numbers coming in via the Twilio webhook (which uses the
  // "whatsapp:+..." prefix in the same customer_phone column).
  const channelPrefix = payload.object === 'instagram' ? 'instagram:' : 'messenger:';

  const events = (payload.entry ?? []).flatMap((entry) => entry.messaging ?? []);

  for (const event of events) {
    // Skip echoes of our own outbound messages, delivery/read receipts,
    // and any event without actual text content.
    if (event.message?.is_echo) continue;
    const text = event.message?.text;
    const senderId = event.sender?.id;
    if (!text || !senderId) continue;

    const customerPhone = `${channelPrefix}${senderId}`;

    try {
      await handleMessage({
        supabase,
        botId: bot.id,
        systemPrompt: bot.system_prompt ?? '',
        customerPhone,
        senderId,
        text,
        pageAccessToken,
      });
    } catch (error) {
      console.error('[meta-webhook] failed to process event', error);
      // Continue processing other events in the same payload.
    }
  }

  return Response.json({ received: true });
}

type HandleArgs = {
  supabase: SupabaseClient;
  botId: string;
  systemPrompt: string;
  customerPhone: string;
  senderId: string;
  text: string;
  pageAccessToken: string;
};

async function handleMessage({
  supabase,
  botId,
  systemPrompt,
  customerPhone,
  senderId,
  text,
  pageAccessToken,
}: HandleArgs): Promise<void> {
  // Upsert the conversation row keyed on (bot_id, customer_phone).
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .upsert(
      { bot_id: botId, customer_phone: customerPhone },
      { onConflict: 'bot_id,customer_phone' },
    )
    .select('id')
    .single();
  if (convError || !conversation) {
    throw new Error(`upsert conversation failed: ${convError?.message}`);
  }

  // Persist the incoming user message.
  const { error: userMsgError } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role: 'user',
    content: text,
  });
  if (userMsgError) {
    throw new Error(`insert user message failed: ${userMsgError.message}`);
  }

  // Load recent history (oldest → newest), including the message just written.
  const { data: historyRows, error: historyError } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (historyError) {
    throw new Error(`load history failed: ${historyError.message}`);
  }

  const history: ChatMessage[] = (historyRows ?? [])
    .slice()
    .reverse()
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  // Generate the assistant reply. On the Meta channel the Kalyo bot gets a
  // text-only system prompt suffix that tells Claude to redirect free-trial
  // requests to the WhatsApp deep link. No tools are exposed on this channel.
  const { systemSuffix, options: claudeOptions } = buildKalyoClaudeOptions({
    channel: 'meta',
    bot: { id: botId },
  });
  const fullSystemPrompt = systemPrompt + systemSuffix;

  let replyText: string;
  try {
    replyText = await generateReply(fullSystemPrompt, history, claudeOptions);
  } catch (error) {
    console.error('[meta-webhook] Claude call failed', error);
    replyText = FALLBACK_MESSAGE;
  }

  // Persist assistant reply (best effort — do not abort the send on failure).
  const { error: assistantMsgError } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role: 'assistant',
    content: replyText,
  });
  if (assistantMsgError) {
    console.error('[meta-webhook] failed to insert assistant message', assistantMsgError);
  }

  // Send the reply via Meta Graph API.
  try {
    await sendMessengerMessage({
      recipientId: senderId,
      text: replyText,
      pageAccessToken,
    });
  } catch (error) {
    console.error('[meta-webhook] Graph API send failed', error);
  }
}
