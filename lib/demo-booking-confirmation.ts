import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { demoGreetingName } from '@/lib/demo-customer-name';
import {
  demoTimeZonePhrase,
  formatDemoTime12h,
  type DemoDisplayTimezone,
} from '@/lib/demo-reminder-messages';
import { resolvePhoneTimezone } from '@/lib/timezone-from-phone';

/** Mexico clock, matching the live template copy "(hora de México)". */
const DEMO_CONFIRMATION_TIMEZONE = 'America/Mexico_City';

const DEFAULT_DEMO_MEET_LINK = 'https://meet.google.com/pgd-dxmb-sfk';

/** Previous HSM kalyo_demo_confirmation. Still approved in Meta; sends use v2. */
export const DEMO_CONFIRMATION_TEMPLATE_SID =
  process.env.KALYO_DEMO_CONFIRMATION_TEMPLATE_SID ??
  'HX29d10d428100ef15a89bbd66290dd914';

/** Live HSM: kalyo_demo_confirmation_v2 (UTILITY, es). {{1}} fecha, {{2}} hora, {{3}} zona. */
export const DEMO_CONFIRMATION_V2_TEMPLATE_SID =
  process.env.KALYO_DEMO_CONFIRMATION_V2_TEMPLATE_SID ??
  'HX5273e5777e114ab65abf03ce0658f44a';

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

/** Variables for kalyo_demo_confirmation_v2. Clock follows the phone country. */
export function buildLandingDemoConfirmationV2ContentVariables(params: {
  scheduledAt: Date | string;
  phone?: string | null;
}): Record<string, string> {
  const scheduledAt =
    params.scheduledAt instanceof Date ? params.scheduledAt.toISOString() : params.scheduledAt;
  const phoneZone = resolvePhoneTimezone(params.phone);
  const display: DemoDisplayTimezone = {
    timezone: phoneZone.timezone,
    label: phoneZone.label,
  };
  const rawDate = formatInTimeZone(
    new Date(scheduledAt),
    display.timezone,
    "EEEE d 'de' MMMM",
    { locale: es },
  );
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

  return {
    '1': dateLabel,
    '2': formatDemoTime12h(scheduledAt, display.timezone),
    '3': demoTimeZonePhrase(display),
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

  const contentVariables = buildLandingDemoConfirmationV2ContentVariables({
    scheduledAt: params.scheduledAt,
    phone,
  });

  try {
    await params.sendFn({
      accountSid: params.creds.accountSid,
      authToken: params.creds.authToken,
      from: params.creds.from,
      to: phone,
      contentSid: DEMO_CONFIRMATION_V2_TEMPLATE_SID,
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
