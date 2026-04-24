import 'server-only';
import { sendWhatsApp } from '@/lib/twilio';

export type NotifySalesInput = {
  title?: string;
  name?: string;
  phone?: string;
  email?: string;
  // ISO string for the trial expiry date (variable 4 in the WhatsApp template).
  expires_at?: string;
  preferred_time?: string;
  reason?: string;
  conversation_summary?: string;
  // Injected server-side by the webhook from the Twilio "From" field, not set
  // by Claude. Used to fall back as the phone value when the lead did not volunteer one.
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

  const expiresAt = clean(input.expires_at);

  const localeOpts: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };

  const dateStr = new Date().toLocaleString('es-MX', localeOpts);
  const expiresStr = expiresAt ? new Date(expiresAt).toLocaleString('es-MX', localeOpts) : '—';

  const contentVariables: Record<string, string> = {
    '1': email ?? '—',
    '2': phone ?? '—',
    '3': dateStr,
    '4': expiresStr,
    '5': 'WhatsApp',
  };

  try {
    await sendWhatsApp({
      accountSid: creds.accountSid,
      authToken: creds.authToken,
      from: creds.from,
      to: salesPhone,
      contentSid: 'HX17bbd7e1e48a1f28805d284ad264e36a',
      contentVariables,
    });
    return { status: 'success' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[kalyo-notify] send failed', error);
    return { status: 'error', message };
  }
}
