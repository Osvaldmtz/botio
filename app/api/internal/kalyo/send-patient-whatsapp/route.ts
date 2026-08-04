import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidPhone, normalizePhoneForDB } from '@/lib/phone-validation';
import { sendWhatsAppMessage } from '@/lib/twilio';

export const dynamic = 'force-dynamic';

const DEFAULT_KALYO_BOT_ID = '64f6eed2-1522-48fe-a2c6-f858b767df06';

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.BOTIO_WEBHOOK_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

async function loadKalyoTwilioCreds() {
  const supabase = createAdminClient();
  const botId = process.env.KALYO_BOT_ID ?? DEFAULT_KALYO_BOT_ID;
  const { data: bot, error } = await supabase
    .from('bots')
    .select('twilio_account_sid, twilio_auth_token, twilio_whatsapp_number')
    .eq('id', botId)
    .maybeSingle();

  if (error || !bot) {
    console.error('[kalyo/send-patient-whatsapp] failed to load bot creds', error);
    return null;
  }

  const accountSid = bot.twilio_account_sid ?? process.env.TWILIO_ACCOUNT_SID;
  const authToken = bot.twilio_auth_token ?? process.env.TWILIO_AUTH_TOKEN;
  const from = bot.twilio_whatsapp_number ?? process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
}

function parseContentVariables(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = String(value ?? '');
  }
  return out;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const phoneRaw = String(record.phone ?? '').trim();
  const messageBody = String(record.body ?? '').trim();
  const contentSid = String(record.content_sid ?? '').trim();
  const contentVariables = parseContentVariables(record.content_variables);

  if (!phoneRaw) {
    return NextResponse.json({ ok: false, error: 'phone is required' }, { status: 400 });
  }

  if (!messageBody && !contentSid) {
    return NextResponse.json(
      { ok: false, error: 'body or content_sid is required' },
      { status: 400 },
    );
  }

  if (!isValidPhone(phoneRaw)) {
    return NextResponse.json(
      { ok: false, error: 'phone must be valid E.164 format' },
      { status: 400 },
    );
  }

  const creds = await loadKalyoTwilioCreds();
  if (!creds) {
    return NextResponse.json({ ok: false, error: 'Twilio not configured' }, { status: 500 });
  }

  const to = normalizePhoneForDB(phoneRaw);

  try {
    const result = await sendWhatsAppMessage({
      accountSid: creds.accountSid,
      authToken: creds.authToken,
      from: creds.from,
      to,
      ...(contentSid
        ? { contentSid, contentVariables: contentVariables ?? {} }
        : { body: messageBody }),
    });
    return NextResponse.json({ ok: true, sid: result.sid, used_template: Boolean(contentSid) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[kalyo/send-patient-whatsapp] send failed', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
