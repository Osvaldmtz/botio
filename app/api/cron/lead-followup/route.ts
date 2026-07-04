import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsApp } from '@/lib/twilio';
import {
  buildFollowupMessage,
  getFirstUserMessageWithTimestamp,
  getLeadTimezone,
  isLeadBusinessHours,
} from '@/lib/conversation-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_WAIT_MS = 4 * 60 * 60 * 1000;
const MAX_WINDOW_MS = 48 * 60 * 60 * 1000;

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

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${secret}`;
}

function isUserMessageReadyForFollowup(userMessageAt: string, now: number): boolean {
  const userMsgTime = new Date(userMessageAt).getTime();
  const elapsed = now - userMsgTime;
  return elapsed >= MIN_WAIT_MS && elapsed <= MAX_WINDOW_MS;
}

async function runLeadFollowup(): Promise<Response> {
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
  const now = Date.now();

  const { data: conversations, error: queryError } = await supabase
    .from('conversation_summary')
    .select('id, customer_phone, message_count, followup_sent, lead_captured, is_closed')
    .eq('bot_id', botId)
    .eq('followup_sent', false)
    .eq('lead_captured', false)
    .eq('is_closed', false)
    .eq('message_count', 2);

  if (queryError) {
    console.error('[lead-followup] query failed', queryError);
    return Response.json({ error: queryError.message }, { status: 500 });
  }

  const candidates = conversations ?? [];
  console.log(`[lead-followup] starting | candidates query result count: ${candidates.length}`);

  let sent = 0;
  let failed = 0;
  let skippedBusinessHours = 0;

  for (const conv of candidates) {
    const firstUser = await getFirstUserMessageWithTimestamp(supabase, conv.id);
    if (!firstUser) {
      console.error('[lead-followup] conv skipped | reason: no_user_message', {
        conversationId: conv.id,
        phone: conv.customer_phone,
      });
      continue;
    }

    if (!isUserMessageReadyForFollowup(firstUser.created_at, now)) {
      continue;
    }

    const leadTz = getLeadTimezone(conv.customer_phone);
    if (!isLeadBusinessHours(conv.customer_phone)) {
      skippedBusinessHours++;
      console.log(
        `[lead-followup] conv ${conv.id} skipped | reason: outside_business_hours | phone: ${conv.customer_phone} | lead_tz: ${leadTz}`,
      );
      continue;
    }

    try {
      const body = buildFollowupMessage(firstUser.content);
      const preview = firstUser.content.slice(0, 60);

      await sendWhatsApp({
        accountSid: creds.accountSid,
        authToken: creds.authToken,
        from: creds.from,
        to: conv.customer_phone,
        body,
      });

      await supabase.from('messages').insert({
        conversation_id: conv.id,
        role: 'assistant',
        content: body,
        metadata: { source: 'lead_followup' },
      });

      const followupAt = new Date().toISOString();
      await supabase
        .from('conversations')
        .update({ followup_sent: true, last_message_at: followupAt })
        .eq('id', conv.id);

      sent++;
      console.log(
        `[lead-followup] conv ${conv.id} sent | phone: ${conv.customer_phone} | first_message_preview: ${preview}`,
      );
    } catch (error) {
      failed++;
      console.error('[lead-followup] send failed', {
        conversationId: conv.id,
        phone: conv.customer_phone,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(
    `[lead-followup] summary | found: ${candidates.length} | sent: ${sent} | skipped_business_hours: ${skippedBusinessHours} | failed: ${failed}`,
  );

  return Response.json({
    found: candidates.length,
    sent,
    skipped_business_hours: skippedBusinessHours,
    failed,
  });
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return new Response('Unauthorized', { status: 401 });
  }
  return runLeadFollowup();
}
