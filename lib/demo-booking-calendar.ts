import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { toGoogleHostDateTime } from '@/lib/calendar-slots';
import { deliverLandingDemoConfirmationWhatsApp } from '@/lib/demo-booking-confirmation';
import {
  assertBookableDemoPhone,
  buildConfirmationFailedAlert,
} from '@/lib/demo-phone';
import {
  DEMO_HOST_EMAIL,
  DEMO_HOST_NAME,
  DEMO_TIMEZONE,
  assertDemoSlotBookable,
  getCalendarClient,
  getDemoMeetLink,
} from '@/lib/google-calendar';
import { DemoSlotUnavailableError } from '@/lib/demo-availability';

const DEFAULT_DURATION_MINUTES = 30;

export type DemoBookingCalendarInput = {
  bookingId: string;
  name: string;
  email: string;
  whatsapp: string;
  country?: string | null;
  interest?: string | null;
  scheduledAt: string;
};

export type DemoBookingCalendarResult = {
  ok: boolean;
  eventId?: string;
  meetLink?: string | null;
  error?: string;
  code?: string;
  skipped?: boolean;
};

async function loadKalyoTwilioCreds(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<{ accountSid: string; authToken: string; from: string } | null> {
  const botId = process.env.KALYO_BOT_ID;
  if (!botId) {
    console.error('[demo-booking-calendar] missing KALYO_BOT_ID');
    return null;
  }

  const { data, error } = await supabase
    .from('bots')
    .select('twilio_account_sid, twilio_auth_token, twilio_whatsapp_number')
    .eq('id', botId)
    .maybeSingle();

  if (error) {
    console.error('[demo-booking-calendar] failed to load Twilio creds', error.message);
    return null;
  }
  if (!data?.twilio_account_sid || !data.twilio_auth_token || !data.twilio_whatsapp_number) {
    console.error('[demo-booking-calendar] Kalyo bot is missing Twilio credentials');
    return null;
  }

  return {
    accountSid: data.twilio_account_sid,
    authToken: data.twilio_auth_token,
    from: data.twilio_whatsapp_number,
  };
}

async function markConfirmationSent(
  supabase: ReturnType<typeof createAdminClient>,
  bookingId: string,
  phone: string,
  scheduledAt: string,
  sent: boolean,
): Promise<void> {
  const { error: bookingError } = await supabase
    .from('demo_bookings')
    .update({ confirmation_sent: sent })
    .eq('id', bookingId);
  if (bookingError) {
    console.error('[demo-booking-calendar] confirmation_sent booking update failed', bookingError);
  }

  const { error: demoError } = await supabase
    .from('scheduled_demos')
    .update({ confirmation_sent: sent })
    .eq('customer_phone', phone)
    .eq('scheduled_at', scheduledAt);
  if (demoError) {
    console.error('[demo-booking-calendar] confirmation_sent demo update failed', demoError);
  }
}

async function alertConfirmationFailed(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    console.error('[demo-booking-calendar] telegram alert skipped, missing env');
    return;
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) {
    console.error('[demo-booking-calendar] telegram alert failed', response.status);
  }
}

function buildDescription(input: DemoBookingCalendarInput, meetLink: string): string {
  const lines = [
    `Demo de ${DEFAULT_DURATION_MINUTES} minutos con ${input.name}`,
    '',
    `Meet: ${meetLink}`,
    '',
    `Email: ${input.email}`,
    `WhatsApp: ${input.whatsapp}`,
    `País: ${input.country ?? '—'}`,
  ];
  if (input.interest?.trim()) {
    lines.push(`Interés: ${input.interest.trim()}`);
  }
  lines.push('', 'Agendado vía kalyo.io/demo');
  return lines.join('\n');
}

export async function createDemoBookingCalendarEvent(
  input: DemoBookingCalendarInput,
): Promise<DemoBookingCalendarResult> {
  const supabase = createAdminClient();

  const { data: existing, error: readError } = await supabase
    .from('demo_bookings')
    .select('google_event_id, google_meet_link')
    .eq('id', input.bookingId)
    .maybeSingle();

  if (readError) {
    return { ok: false, error: readError.message };
  }

  if (existing?.google_event_id) {
    return {
      ok: true,
      skipped: true,
      eventId: existing.google_event_id,
      meetLink: existing.google_meet_link,
    };
  }

  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    return { ok: false, error: 'invalid scheduledAt' };
  }

  const credsForCheck = await loadKalyoTwilioCreds(supabase);
  const phoneCheck = await assertBookableDemoPhone(input.whatsapp, credsForCheck);
  if (!phoneCheck.ok) {
    await markConfirmationSent(supabase, input.bookingId, input.whatsapp, input.scheduledAt, false);
    await alertConfirmationFailed(
      buildConfirmationFailedAlert({
        name: input.name,
        phone: input.whatsapp,
        email: input.email,
        when: input.scheduledAt,
        reason: phoneCheck.message,
      }),
    );
    return { ok: false, error: phoneCheck.message, code: 'invalid_phone' };
  }
  const customerPhone = phoneCheck.e164;

  const endAt = new Date(scheduledAt.getTime() + DEFAULT_DURATION_MINUTES * 60_000);

  try {
    await assertDemoSlotBookable({
      slotStart: scheduledAt,
      durationMinutes: DEFAULT_DURATION_MINUTES,
      excludeBookingId: input.bookingId,
    });
  } catch (err) {
    if (err instanceof DemoSlotUnavailableError) {
      return { ok: false, error: err.message, code: 'slot_unavailable' };
    }
    throw err;
  }

  const meetLink = getDemoMeetLink();

  try {
    const calendar = await getCalendarClient();

    const event = await calendar.events.insert({
      calendarId: 'primary',
      sendUpdates: 'all',
      requestBody: {
        summary: `Demo Kalyo — ${input.name}`,
        description: buildDescription(input, meetLink),
        location: meetLink,
        start: {
          dateTime: toGoogleHostDateTime(scheduledAt),
          timeZone: DEMO_TIMEZONE,
        },
        end: {
          dateTime: toGoogleHostDateTime(endAt),
          timeZone: DEMO_TIMEZONE,
        },
        attendees: [
          { email: DEMO_HOST_EMAIL, displayName: DEMO_HOST_NAME },
          { email: input.email, displayName: input.name },
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 10 },
          ],
        },
      },
    });

    const eventId = event.data.id;
    if (!eventId) {
      return { ok: false, error: 'Google Calendar did not return event id' };
    }

    const updatePayload: Record<string, string | null> = {
      google_event_id: eventId,
      google_meet_link: meetLink,
      meet_link: meetLink,
    };

    const { error: updateError } = await supabase
      .from('demo_bookings')
      .update(updatePayload)
      .eq('id', input.bookingId);

    if (updateError) {
      console.error('[demo-booking-calendar] failed to persist event id', updateError);
    }

    console.log(
      `[demo-booking-calendar] event created | booking_id=${input.bookingId} | event_id=${eventId} | meet=${meetLink}`,
    );

    try {
      const { notifyDemoConfirmed } = await import('@/lib/demo-confirmed-notify');
      const { resolveDemoCustomerName, nameFromEmailLocalPart } = await import(
        '@/lib/demo-customer-name'
      );
      const safeName = resolveDemoCustomerName({
        formName: input.name,
        emailLocalPart: nameFromEmailLocalPart(input.email),
      });
      await notifyDemoConfirmed({
        customerName: safeName,
        customerEmail: input.email,
        customerPhone: input.whatsapp,
        scheduledAt,
        meetLink,
        source: 'landing_demo',
        bookingId: input.bookingId,
        country: input.country,
        interest: input.interest,
      });
    } catch (err) {
      console.error(
        '[demo-booking-calendar] notify failed (non-fatal)',
        err instanceof Error ? err.message : err,
      );
    }

    try {
      const creds = await loadKalyoTwilioCreds(supabase);
      const { sendWhatsApp } = await import('@/lib/twilio');
      const confirmation = await deliverLandingDemoConfirmationWhatsApp({
        name: input.name,
        whatsapp: customerPhone,
        scheduledAt,
        meetLink,
        creds,
        sendFn: sendWhatsApp,
      });
      const sent = confirmation === 'sent';
      await markConfirmationSent(
        supabase,
        input.bookingId,
        customerPhone,
        input.scheduledAt,
        sent,
      );
      if (!sent) {
        await alertConfirmationFailed(
          buildConfirmationFailedAlert({
            name: input.name,
            phone: customerPhone,
            email: input.email,
            when: input.scheduledAt,
            reason:
              confirmation === 'skipped_no_phone'
                ? 'sin número de WhatsApp'
                : 'Twilio no aceptó el mensaje de confirmación',
          }),
        );
      }
      console.log(
        `[demo-booking-calendar] confirmation whatsapp | booking_id=${input.bookingId} | result=${confirmation}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[demo-booking-calendar] confirmation whatsapp failed (non-fatal)', message);
      await markConfirmationSent(supabase, input.bookingId, customerPhone, input.scheduledAt, false);
      await alertConfirmationFailed(
        buildConfirmationFailedAlert({
          name: input.name,
          phone: customerPhone,
          email: input.email,
          when: input.scheduledAt,
          reason: message,
        }),
      );
    }

    return { ok: true, eventId, meetLink };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[demo-booking-calendar] create event failed', {
      bookingId: input.bookingId,
      error: message,
    });
    return { ok: false, error: message };
  }
}
