import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getKalyoClient } from '@/lib/kalyo';
import { sendWhatsApp } from '@/lib/twilio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MESSAGE_3_DAYS =
  'Hola! Tu prueba Pro de Kalyo termina en 3 días 🔔 ¿Qué te ha parecido hasta ahora? Si quieres continuar, puedes suscribirte en kalyo.io por $29/mes';

const MESSAGE_TODAY =
  'Tu prueba gratuita de Kalyo Pro termina hoy 😊 ¿Quieres continuar? Suscríbete en kalyo.io por $29/mes y sigue evaluando a tus pacientes sin límites';

type TrialUser = {
  id: string;
  email: string;
  phone: string;
  trial_ends_at: string;
};

type TwilioCreds = {
  accountSid: string;
  authToken: string;
  from: string;
};

// UTC day boundaries for `trial_ends_at` matching. Kalyo is Mexico-focused;
// the daily cron firing at 14:00 UTC (~08:00 CDMX) keeps notifications in
// the user's morning window regardless of this being UTC-aligned.
function utcDayRange(daysFromNow: number): { start: string; end: string } {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + daysFromNow);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('whatsapp:')) return trimmed;
  if (trimmed.startsWith('+')) return trimmed;
  return `+${trimmed.replace(/\D/g, '')}`;
}

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

async function findTrialUsersExpiring(daysFromNow: number): Promise<TrialUser[]> {
  const { start, end } = utcDayRange(daysFromNow);
  const supabase = getKalyoClient();
  const { data, error } = await supabase
    .from('psychologists')
    .select('id, email, phone, trial_ends_at')
    .eq('plan', 'professional')
    .not('phone', 'is', null)
    .gte('trial_ends_at', start)
    .lt('trial_ends_at', end);
  if (error) {
    console.error(`[cron] failed to load users expiring in ${daysFromNow}d`, error);
    return [];
  }
  return (data ?? []).filter(
    (u): u is TrialUser => typeof u.phone === 'string' && u.phone.trim().length > 0,
  );
}

async function sendBatch(
  users: TrialUser[],
  body: string,
  creds: TwilioCreds,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const user of users) {
    try {
      await sendWhatsApp({
        accountSid: creds.accountSid,
        authToken: creds.authToken,
        from: creds.from,
        to: normalizePhone(user.phone),
        body,
      });
      sent++;
    } catch (error) {
      failed++;
      console.error('[cron] send failed', {
        email: user.email,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { sent, failed };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron] CRON_SECRET not configured');
    return new Response('Cron secret not configured', { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let creds: TwilioCreds;
  try {
    creds = await loadKalyoBotCreds();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[cron] init failed', error);
    return Response.json({ error: message }, { status: 500 });
  }

  const [threeDayUsers, todayUsers] = await Promise.all([
    findTrialUsersExpiring(3),
    findTrialUsersExpiring(0),
  ]);

  const [threeDayResult, todayResult] = await Promise.all([
    sendBatch(threeDayUsers, MESSAGE_3_DAYS, creds),
    sendBatch(todayUsers, MESSAGE_TODAY, creds),
  ]);

  return Response.json({
    three_day: { found: threeDayUsers.length, ...threeDayResult },
    today: { found: todayUsers.length, ...todayResult },
  });
}
