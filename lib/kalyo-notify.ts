import 'server-only';
import { sendWhatsApp } from '@/lib/twilio';
import { getKalyoClient } from '@/lib/kalyo';

export type NotifySalesInput = {
  name?: string;
  phone?: string;
  email?: string;
  preferred_time?: string;
  reason?: string;
  conversation_summary?: string;
  // Injected server-side by the webhook from the Twilio "From" field, not set
  // by Claude. Used to always show the sender's WhatsApp number and to fall
  // back as the phone value when the lead did not volunteer one.
  whatsapp_number?: string;
};

export type NotifySalesCreds = {
  accountSid: string;
  authToken: string;
  from: string;
};

export type NotifySalesResult = { status: 'success' } | { status: 'error'; message: string };

function clean(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function stripWhatsAppPrefix(value: string | undefined): string | undefined {
  const trimmed = clean(value);
  if (!trimmed) return undefined;
  return trimmed.startsWith('whatsapp:') ? trimmed.slice('whatsapp:'.length) : trimmed;
}

async function lookupKalyoAccount(email: string): Promise<{ plan: string } | null> {
  try {
    const supabase = getKalyoClient();
    const { data } = await supabase
      .from('psychologists')
      .select('plan')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export async function notifySalesTeam(
  input: NotifySalesInput,
  creds: NotifySalesCreds,
): Promise<NotifySalesResult> {
  const name = clean(input.name);
  const explicitPhone = clean(input.phone);
  const whatsappNumber = stripWhatsAppPrefix(input.whatsapp_number);
  // Fall back to the sender's WhatsApp number when the lead did not give one.
  const phone = explicitPhone ?? whatsappNumber;
  const email = clean(input.email);

  // Require at least one identity field so an empty/accidental tool call
  // does not spam the sales team with blank leads.
  if (!name && !phone && !email) {
    return {
      status: 'error',
      message: 'At least one of name, phone, or email is required',
    };
  }

  const salesPhone = process.env.KALYO_SALES_PHONE;
  if (!salesPhone) {
    console.error('[kalyo-notify] KALYO_SALES_PHONE not configured');
    return { status: 'error', message: 'Sales phone not configured' };
  }

  const existingAccount = email ? await lookupKalyoAccount(email) : null;

  const now = new Date();
  const dateStr = now.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const headerEmoji = existingAccount ? '⚠️' : '🆕';

  const lines = [
    `${headerEmoji} *Nuevo trial solicitado*`,
    `👤 Nombre: ${name ?? 'No proporcionó'}`,
    `📧 Email: ${email ?? 'No proporcionó'}`,
    `📞 Teléfono: ${phone ?? 'No proporcionó'}`,
    `📅 Fecha: ${dateStr}`,
    `💬 Canal: WhatsApp`,
  ];

  if (existingAccount) {
    lines.push(`⚠️ Ya tiene cuenta — Plan: ${existingAccount.plan}`);
  }

  const body = lines.join('\n');

  try {
    await sendWhatsApp({
      accountSid: creds.accountSid,
      authToken: creds.authToken,
      from: creds.from,
      to: salesPhone,
      body,
    });
    return { status: 'success' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[kalyo-notify] send failed', error);
    return { status: 'error', message };
  }
}
