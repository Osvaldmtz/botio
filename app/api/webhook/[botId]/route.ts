import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsApp, emptyTwimlResponse } from '@/lib/twilio';
import { normalizePhone } from '@/lib/phone';
import { transcribeAudio } from '@/lib/audio-transcription';
import { processIncomingMessage } from '@/lib/process-message';

const UNSUPPORTED_MEDIA_MESSAGE =
  'Por ahora solo puedo procesar audio o texto. ¿Me lo escribes o me mandas audio? 🙏';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRANSCRIPTION_FAIL_MESSAGE =
  'No pude transcribir tu audio, ¿podrías escribírmelo o intentarlo de nuevo? 🙏';

type BotCredentials = {
  id: string;
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
    .select('id, twilio_account_sid, twilio_auth_token, twilio_whatsapp_number, is_active')
    .eq('id', botId)
    .maybeSingle();

  if (botError || !bot) {
    return new Response('Bot not found', { status: 404 });
  }
  if (!bot.is_active) {
    return new Response('Bot inactive', { status: 403 });
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

  let result;
  try {
    result = await processIncomingMessage({
      supabase,
      botId: bot.id,
      channel: 'whatsapp',
      identifier: from,
      messageBody: incoming.body,
      metadata: incoming.meta.metadata,
      userMessageSource: incoming.meta.source,
      audioDurationSeconds: incoming.meta.audioDurationSeconds,
    });
  } catch (error) {
    console.error('[webhook] processIncomingMessage failed', error);
    return new Response('Internal error', { status: 500 });
  }

  if (result.rateLimited) {
    return new Response(null, { status: 200 });
  }

  if (result.source === 'human') {
    return emptyTwimlResponse();
  }

  const outboundBody = result.replyText ?? result.storedReply;
  if (outboundBody && bot.twilio_account_sid && bot.twilio_auth_token && bot.twilio_whatsapp_number) {
    try {
      await sendWhatsApp({
        accountSid: bot.twilio_account_sid,
        authToken: bot.twilio_auth_token,
        from: bot.twilio_whatsapp_number,
        to: from,
        body: outboundBody,
        quickReplies: result.quickReplies,
      });
    } catch (error) {
      console.error('[webhook] Twilio send failed', error);
    }
  }

  const totalLatencyMs = Date.now() - webhookStartedAt;
  console.log(
    `[webhook-stats] source=${result.source} latency_ms=${totalLatencyMs} conv=${result.conversationId}`,
  );

  return emptyTwimlResponse();
}
