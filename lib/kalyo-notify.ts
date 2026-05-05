import 'server-only';
import { sendWhatsApp } from '@/lib/twilio';
import { normalizePhone } from '@/lib/phone';
import { sendLeadTelegram } from '@/lib/telegram-notify';

export type NotifySalesInput = {
  title?: string;
  name?: string;
  phone?: string;
  email?: string;
  // ISO string for the trial expiry date.
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

const WHATSAPP_HEADERS: Record<string, string> = {
  requested_human: '🙋 Lead pidió hablar con humano',
  purchase_intent: '💰 Intención de compra',
  new_lead: '📬 Nuevo lead Kalyo',
  escalation: '⚠️ Escalación de conversación',
  activate_trial: '🎁 Trial Pro activado',
};

function buildWhatsAppBody(
  reason: string | undefined,
  name: string | undefined,
  phone: string | undefined,
  email: string | undefined,
  summary: string | undefined,
  dateStr: string,
  expiresStr: string,
): string {
  const header = WHATSAPP_HEADERS[reason ?? ''] ?? '📬 Notificación Kalyo';
  const lines = [
    header,
    `Nombre: ${name ?? '—'}`,
    `Teléfono: ${phone ?? '—'}`,
    `Email: ${email ?? '—'}`,
    `Fecha: ${dateStr}`,
  ];
  if (reason === 'activate_trial' && expiresStr !== '—') {
    lines.push(`Vence: ${expiresStr}`);
  }
  if (summary) lines.push(`Resumen: ${summary}`);
  return lines.join('\n');
}

export async function notifySalesTeam(
  input: NotifySalesInput,
  creds: NotifySalesCreds,
): Promise<NotifySalesResult> {
  const name = clean(input.name);
  const explicitPhone = clean(input.phone);
  const whatsappNumber = normalizePhone(input.whatsapp_number);
  // Fall back to the sender's WhatsApp number when the lead did not volunteer one.
  const phone = explicitPhone ?? whatsappNumber;
  const email = clean(input.email);

  // Require at least one identity field so an empty/accidental tool call
  // does not spam the sales team with blank leads.
  if (!name && !phone && !email) {
    return { status: 'error', message: 'At least one of name, phone, or email is required' };
  }

  const salesPhone = process.env.KALYO_SALES_PHONE;
  if (!salesPhone) {
    console.error('[kalyo-notify] KALYO_SALES_PHONE not configured');
    return { status: 'error', message: 'Sales phone not configured' };
  }

  const reason = clean(input.reason);
  const summary = clean(input.conversation_summary);
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

  console.log('[kalyo-notify] notifying sales team', {
    salesPhone,
    name: name ?? '—',
    phone: phone ?? '—',
    email: email ?? '—',
    reason: reason ?? '—',
  });

  const whatsAppBody = buildWhatsAppBody(reason, name, phone, email, summary, dateStr, expiresStr);

  console.log('[kalyo-notify] about to call Promise.allSettled for both channels');
  const [waResult, tgResult] = await Promise.allSettled([
    sendWhatsApp({
      accountSid: creds.accountSid,
      authToken: creds.authToken,
      from: creds.from,
      to: salesPhone,
      body: whatsAppBody,
    }),
    sendLeadTelegram({ name, phone, email, reason, conversation_summary: summary, expires_at: expiresAt }),
  ]);

  console.log('[kalyo-notify] Promise.allSettled done | wa:', waResult.status, '| tg:', tgResult.status);

  // Log each channel independently
  if (waResult.status === 'fulfilled') {
    console.log('[kalyo-notify] WhatsApp: success');
  } else {
    console.error('[kalyo-notify] WhatsApp: failed', waResult.reason);
  }

  if (tgResult.status === 'rejected') {
    console.error('[telegram-notify] Telegram: failed (rejected)', tgResult.reason);
  } else if (!tgResult.value.success) {
    console.error('[telegram-notify] Telegram: failed', tgResult.value.error);
  } else {
    console.log('[telegram-notify] Telegram: success');
  }

  const waOk = waResult.status === 'fulfilled';
  const tgOk = tgResult.status === 'fulfilled' && tgResult.value.success;

  if (!waOk && !tgOk) {
    const waMsg = waResult.status === 'rejected' ? String(waResult.reason) : 'WhatsApp send error';
    return { status: 'error', message: `Both channels failed. WhatsApp: ${waMsg}` };
  }

  return { status: 'success' };
}
