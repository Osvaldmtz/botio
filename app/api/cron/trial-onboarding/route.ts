import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { runTrialOnboardingCron } from '@/lib/trial-onboarding-cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadKalyoBotCreds() {
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
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const creds = await loadKalyoBotCreds();
    const supabase = createAdminClient();
    const summary = await runTrialOnboardingCron({ supabase, creds });
    return Response.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[trial-onboarding] cron failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
