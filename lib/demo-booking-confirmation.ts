import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { DEMO_NAME_FALLBACK, demoGreetingName } from '@/lib/demo-customer-name';
import { formatDemoTime12h } from '@/lib/demo-reminder-messages';

/** Mexico clock, matching the template copy "(hora de México)". */
const DEMO_CONFIRMATION_TIMEZONE = 'America/Mexico_City';

const DEFAULT_DEMO_MEET_LINK = 'https://meet.google.com/pgd-dxmb-sfk';

/** Approved WhatsApp HSM: kalyo_demo_confirmation (UTILITY, es). */
export const DEMO_CONFIRMATION_TEMPLATE_SID =
  process.env.KALYO_DEMO_CONFIRMATION_TEMPLATE_SID ??
  'HX29d10d428100ef15a89bbd66290dd914';

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
  contentSid?: string;
  contentVariables?: Record<string, string>;
}) => Promise<void>;

export function buildLandingDemoConfirmationContentVariables(params: {
  name: string;
  scheduledAt: Date | string;
  meetLink?: string | null;
}): Record<string, string> {
  const scheduledAt =
    params.scheduledAt instanceof Date ? params.scheduledAt.toISOString() : params.scheduledAt;
  const rawDate = formatInTimeZone(
    new Date(scheduledAt),
    DEMO_CONFIRMATION_TIMEZONE,
    "EEEE d 'de' MMMM",
    { locale: es },
  );
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
  const meet =
    params.meetLink?.trim() ||
    process.env.KALYO_DEMO_MEET_LINK?.trim() ||
    DEFAULT_DEMO_MEET_LINK;
  const timeLabel = formatDemoTime12h(scheduledAt, DEMO_CONFIRMATION_TIMEZONE)
    .replace(/\bAM\b/, 'a.m.')
    .replace(/\bPM\b/, 'p.m.');

  return {
    '1': demoGreetingName(params.name),
    '2': dateLabel,
    '3': timeLabel,
    '4': meet,
  };
}

/**
 * Immediate WhatsApp confirmation for a kalyo.io/demo booking.
 * Blank phone skips the send; the Google Calendar invite email is the customer notice.
 */
export async function deliverLandingDemoConfirmationWhatsApp(params: {
  name: string;
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

  const contentVariables = buildLandingDemoConfirmationContentVariables({
    name: params.name,
    scheduledAt: params.scheduledAt,
    meetLink: params.meetLink,
  });
  if (!contentVariables['1']) contentVariables['1'] = DEMO_NAME_FALLBACK;

  try {
    await params.sendFn({
      accountSid: params.creds.accountSid,
      authToken: params.creds.authToken,
      from: params.creds.from,
      to: phone,
      contentSid: DEMO_CONFIRMATION_TEMPLATE_SID,
      contentVariables,
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
