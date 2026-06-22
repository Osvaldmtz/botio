import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export async function testDB(): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('bots').select('id').limit(1).maybeSingle();
    return !error;
  } catch {
    return false;
  }
}

export async function testTwilio(): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return false;

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function testClaude(): Promise<boolean> {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function testTelegram(): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    return response.ok;
  } catch {
    return false;
  }
}
