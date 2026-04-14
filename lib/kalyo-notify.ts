import 'server-only';
import { sendWhatsApp } from '@/lib/twilio';

export type NotifySalesInput = {
  name?: string;
  phone?: string;
  email?: string;
  preferred_time?: string;
  reason?: string;
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

export async function notifySalesTeam(
  input: NotifySalesInput,
  creds: NotifySalesCreds,
): Promise<NotifySalesResult> {
  const name = clean(input.name);
  const phone = clean(input.phone);
  const email = clean(input.email);
  const preferredTime = clean(input.preferred_time);
  const reason = clean(input.reason);

  // Require at least one identity field so an empty/accidental tool call
  // does not spam the sales team with blank leads.
  if (!name && !phone) {
    return {
      status: 'error',
      message: 'Either name or phone is required to notify the sales team',
    };
  }

  const salesPhone = process.env.KALYO_SALES_PHONE;
  if (!salesPhone) {
    console.error('[kalyo-notify] KALYO_SALES_PHONE not configured');
    return { status: 'error', message: 'Sales phone not configured' };
  }

  const body = [
    '🔔 *Nuevo lead Kalyo*',
    `👤 Nombre: ${name ?? '—'}`,
    `📱 Teléfono: ${phone ?? '—'}`,
    `📧 Correo: ${email ?? '—'}`,
    `🕐 Horario: ${preferredTime ?? '—'}`,
    `💬 Motivo: ${reason ?? '—'}`,
    '',
    'Responde directamente a este número.',
  ].join('\n');

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
