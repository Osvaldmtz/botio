import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsApp } from '@/lib/twilio';
import { touchConversation } from '@/lib/conversation-utils';
import { normalizeChannel } from '@/lib/channel-utils';
import { sendTelegramPublicMessage } from '@/lib/telegram-public';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

type SendBody = {
  text: string;
  sent_by?: string;
};

export async function POST(request: Request, { params }: Params) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: SendBody;
  try {
    body = (await request.json()) as SendBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const sentBy = body.sent_by?.trim() || 'Admin';
  const supabase = createAdminClient();
  const conversationId = params.id;

  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id, customer_phone, bot_id, handoff_active, handoff_taken_by, channel')
    .eq('id', conversationId)
    .maybeSingle();

  if (convError) {
    return NextResponse.json({ error: convError.message }, { status: 500 });
  }
  if (!conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!conversation.handoff_active) {
    return NextResponse.json(
      { error: 'Handoff is not active — take control before sending messages' },
      { status: 409 },
    );
  }

  const channel = normalizeChannel(conversation.channel);

  if (channel === 'whatsapp') {
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('twilio_account_sid, twilio_auth_token, twilio_whatsapp_number')
      .eq('id', conversation.bot_id)
      .maybeSingle();

    if (botError || !bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 500 });
    }

    if (!bot.twilio_account_sid || !bot.twilio_auth_token || !bot.twilio_whatsapp_number) {
      return NextResponse.json({ error: 'Bot missing Twilio credentials' }, { status: 500 });
    }

    try {
      await sendWhatsApp({
        accountSid: bot.twilio_account_sid,
        authToken: bot.twilio_auth_token,
        from: bot.twilio_whatsapp_number,
        to: conversation.customer_phone,
        body: text,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[handoff-send] Twilio failed', error);
      return NextResponse.json({ error: `Twilio send failed: ${message}` }, { status: 502 });
    }
  } else if (channel === 'telegram') {
    const tgId = conversation.customer_phone.startsWith('tg:')
      ? conversation.customer_phone.slice(3)
      : conversation.customer_phone;

    const sent = await sendTelegramPublicMessage(tgId, text);
    if (!sent.ok) {
      return NextResponse.json(
        { error: sent.error ?? 'Telegram send failed' },
        { status: 502 },
      );
    }
  } else {
    console.log(`[widget-handoff] message sent | conv=${conversationId}`);
  }

  const nowIso = new Date().toISOString();
  const { data: message, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: text,
      source: 'text',
      source_type: 'human',
      metadata: { sent_by: sentBy, channel },
    })
    .select('id, role, content, created_at, source, source_type, metadata')
    .single();

  if (msgError) {
    console.error('[handoff-send] failed to persist message', msgError);
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  await touchConversation(supabase, conversationId, nowIso);

  console.log(
    `[handoff-send] sent message | conv=${conversationId} | channel=${channel} | text_preview="${text.slice(0, 80)}"`,
  );

  return NextResponse.json({ ok: true, message });
}
