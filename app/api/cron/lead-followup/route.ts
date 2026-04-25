import 'server-only';
import { Receiver } from '@upstash/qstash';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsApp } from '@/lib/twilio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FOLLOWUP_MESSAGE =
  'Hola 👋 ¿Pudiste revisar la información sobre Kalyo? Si quieres, puedo activarte tu prueba gratuita de 15 días ahora mismo — sin tarjeta de crédito. ¿Te interesa?';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

type TwilioCreds = {
  accountSid: string;
  authToken: string;
  from: string;
};

async function loadKalyoBotCreds(): Promise<TwilioCreds> {
  const botId = process.env.KALYO_BOT_ID;
  if (!botId) throw new Error('Missing KALYO_BOT_ID');
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('bots')
    .select('twilio_account_sid, twilio_auth_token, twilio_whatsapp_number')
    .eq('id', botId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Kalyo bot ${botId} not found`);
  const { twilio_account_sid, twilio_auth_token, twilio_whatsapp_number } = data;
  if (!twilio_account_sid || !twilio_auth_token || !twilio_whatsapp_number) {
    throw new Error('Kalyo bot is missing Twilio credentials');
  }
  return {
    accountSid: twilio_account_sid as string,
    authToken: twilio_auth_token as string,
    from: twilio_whatsapp_number as string,
  };
}

// Returns current hour (0-23) in America/Bogota timezone.
function getBogotaHour(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  return parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
}

export async function POST(request: Request) {
  const bodyText = await request.text();
  const signature = request.headers.get('upstash-signature') ?? '';

  try {
    await receiver.verify({ signature, body: bodyText });
  } catch {
    return new Response('Invalid signature', { status: 401 });
  }

  // Only send follow-ups between 10:00 and 20:00 Bogota time.
  const bogotaHour = getBogotaHour();
  if (bogotaHour < 10 || bogotaHour >= 20) {
    return Response.json({ skipped: true, reason: 'Outside business hours (10am–8pm Bogota)' });
  }

  const botId = process.env.KALYO_BOT_ID;
  if (!botId) {
    return Response.json({ error: 'Missing KALYO_BOT_ID' }, { status: 500 });
  }

  let creds: TwilioCreds;
  try {
    creds = await loadKalyoBotCreds();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[lead-followup] init failed', error);
    return Response.json({ error: message }, { status: 500 });
  }

  const supabase = createAdminClient();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: conversations, error: queryError } = await supabase
    .from('conversations')
    .select('id, customer_phone')
    .eq('bot_id', botId)
    .eq('followup_sent', false)
    .lt('last_message_at', twoHoursAgo)
    .gt('last_message_at', fortyEightHoursAgo);

  if (queryError) {
    console.error('[lead-followup] query failed', queryError);
    return Response.json({ error: queryError.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const conv of conversations ?? []) {
    try {
      await sendWhatsApp({
        accountSid: creds.accountSid,
        authToken: creds.authToken,
        from: creds.from,
        to: conv.customer_phone,
        body: FOLLOWUP_MESSAGE,
      });
      await supabase
        .from('conversations')
        .update({ followup_sent: true })
        .eq('id', conv.id);
      sent++;
    } catch (error) {
      failed++;
      console.error('[lead-followup] send failed', {
        phone: conv.customer_phone,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return Response.json({ found: (conversations ?? []).length, sent, failed });
}
