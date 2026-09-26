import { formatDemoDateTime } from '@/lib/demo-reminder-messages';
import { resolvePhoneTimezone } from '@/lib/timezone-from-phone';

export type LandingDemoTwilioCreds = {
  accountSid: string;
  authToken: string;
  from: string;
};

export type LandingDemoSendWhatsApp = (args: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  body?: string;
}) => Promise<void>;

export function formatLandingDemoConfirmationWhatsApp(params: {
  scheduledAt: Date | string;
  phone: string;
  meetLink: string;
}): string {
  const { timezone, label } = resolvePhoneTimezone(params.phone);
  const scheduledAt =
    params.scheduledAt instanceof Date ? params.scheduledAt.toISOString() : params.scheduledAt;
  const { dateLabel, timeLabel } = formatDemoDateTime(scheduledAt, timezone, label);
  const meet = params.meetLink.trim();

  return (
    '✅ ¡Demo agendada!\n\n' +
    `📅 ${dateLabel}\n` +
    `⏰ ${timeLabel}\n` +
    `🎥 Meet: ${meet}\n\n` +
    'La invitación también llegó a tu correo.'
  );
}

/**
 * Immediate WhatsApp confirmation for a kalyo.io/demo booking.
 * Blank phone skips the send; the Google Calendar invite email is the customer notice.
 */
export async function deliverLandingDemoConfirmationWhatsApp(params: {
  whatsapp: string | null | undefined;
  scheduledAt: Date;
  meetLink: string;
  creds: LandingDemoTwilioCreds | null;
  sendFn: LandingDemoSendWhatsApp;
}): Promise<'sent' | 'skipped_no_phone' | 'failed'> {
  const phone = params.whatsapp?.trim() ?? '';
  if (!phone) return 'skipped_no_phone';

  if (!params.creds) {
    console.error('[demo-booking-confirmation] missing Twilio creds');
    return 'failed';
  }

  const body = formatLandingDemoConfirmationWhatsApp({
    scheduledAt: params.scheduledAt,
    phone,
    meetLink: params.meetLink,
  });

  try {
    await params.sendFn({
      accountSid: params.creds.accountSid,
      authToken: params.creds.authToken,
      from: params.creds.from,
      to: phone,
      body,
    });
    console.log(`[demo-booking-confirmation] whatsapp sent | to=${phone}`);
    return 'sent';
  } catch (err) {
    console.error(
      '[demo-booking-confirmation] whatsapp failed',
      err instanceof Error ? err.message : err,
    );
    return 'failed';
  }
}
