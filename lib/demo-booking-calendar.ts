import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { toGoogleHostDateTime } from '@/lib/calendar-slots';
import {
  DEMO_HOST_EMAIL,
  DEMO_HOST_NAME,
  DEMO_TIMEZONE,
  getCalendarClient,
  getDemoMeetLink,
} from '@/lib/google-calendar';

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
  skipped?: boolean;
};

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

  const endAt = new Date(scheduledAt.getTime() + DEFAULT_DURATION_MINUTES * 60_000);
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
