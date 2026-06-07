import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { processIncomingMessage } from '@/lib/process-message';
import {
  isTelegramPublicConfigured,
  sendTelegramPublicMessage,
} from '@/lib/telegram-public';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { botId: string } };

type TelegramUpdate = {
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: { id: number; first_name?: string; username?: string };
    text?: string;
  };
};

export async function POST(request: Request, { params }: Params) {
  if (!isTelegramPublicConfigured()) {
    return new Response('telegram bot not configured', { status: 503 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const message = update.message;
  if (!message?.text?.trim() || !message.from) {
    return new Response('OK', { status: 200 });
  }

  const tgUserId = String(message.from.id);
  const text = message.text.trim();
  const chatId = message.chat.id;

  console.log(`[telegram-public] new message | tg_user_id=${tgUserId}`);

  const supabase = createAdminClient();

  const { data: bot, error: botError } = await supabase
    .from('bots')
    .select('id, is_active')
    .eq('id', params.botId)
    .maybeSingle();

  if (botError || !bot) {
    return new Response('Bot not found', { status: 404 });
  }
  if (!bot.is_active) {
    return new Response('Bot inactive', { status: 403 });
  }

  const metadata: Record<string, unknown> = {
    channel: 'telegram',
    telegram_user_id: tgUserId,
    telegram_username: message.from.username ?? null,
    telegram_first_name: message.from.first_name ?? null,
  };

  try {
    const result = await processIncomingMessage({
      supabase,
      botId: params.botId,
      channel: 'telegram',
      identifier: tgUserId,
      messageBody: text,
      metadata,
    });

    if (result.rateLimited) {
      return new Response('OK', { status: 200 });
    }

    console.log(
      `[telegram-public] new message | conv=${result.conversationId} | tg_user_id=${tgUserId}`,
    );

    if (result.source === 'human') {
      return new Response('OK', { status: 200 });
    }

    const reply = result.replyText ?? result.storedReply;
    if (reply) {
      const sent = await sendTelegramPublicMessage(chatId, reply);
      if (!sent.ok) {
        console.error('[telegram-public] failed to send reply', sent.error);
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('[telegram-public] process failed', error);
    return new Response('Internal error', { status: 500 });
  }
}
