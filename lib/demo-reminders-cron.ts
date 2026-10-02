import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildReminder1hContentVariables,
  buildReminder24hContentVariables,
  DEMO_REMINDER_1H_TEMPLATE_SID,
  DEMO_REMINDER_24H_TEMPLATE_SID,
  formatReminder1h,
  formatReminder24h,
  resolveDemoDisplayTimezone,
  type DemoReminderRow,
} from '@/lib/demo-reminder-messages';
import {
  notifyDemoReminderEvent,
  type SendTelegramFn,
} from '@/lib/demo-reminder-notifications';
import {
  deliverDemoChannels,
  demoEmailSubject,
  renderDemoEmailHtml,
  sendDemoEmailViaResend,
  type DemoEmailKind,
} from '@/lib/demo-channel-delivery';

export type TwilioCreds = {
  accountSid: string;
  authToken: string;
  from: string;
};

export type SendWhatsAppFn = (args: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  body?: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
}) => Promise<void>;

const DEMO_SELECT =
  'id, conversation_id, customer_name, customer_email, customer_phone, scheduled_at, google_meet_link, reminder_24h_sent_at, reminder_1h_sent_at';

const BOOKING_SELECT =
  'id, name, email, whatsapp, scheduled_at, meet_link, google_meet_link, status, reminder_24h_sent, reminder_1h_sent';

const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'rescheduled_by_admin'] as const;

const DEFAULT_MEET_LINK = 'https://meet.google.com/pgd-dxmb-sfk';

export type DemoBookingReminderRow = {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  scheduled_at: string;
  meet_link: string | null;
  google_meet_link: string | null;
  status: string;
  reminder_24h_sent: boolean;
  reminder_1h_sent: boolean;
};

function resolveMeetLink(link: string | null | undefined): string {
  return link?.trim() || process.env.KALYO_DEMO_MEET_LINK?.trim() || DEFAULT_MEET_LINK;
}

export function bookingToReminderRow(booking: DemoBookingReminderRow): DemoReminderRow {
  return {
    id: booking.id,
    conversation_id: null,
    customer_name: booking.name,
    customer_email: booking.email,
    customer_phone: booking.whatsapp,
    scheduled_at: booking.scheduled_at,
    google_meet_link: resolveMeetLink(booking.google_meet_link || booking.meet_link),
  };
}

function windowBounds(
  minMs: number,
  maxMs: number,
): { from: string; to: string } {
  const now = Date.now();
  return {
    from: new Date(now + minMs).toISOString(),
    to: new Date(now + maxMs).toISOString(),
  };
}

export async function fetchPending24hReminders(
  supabase: SupabaseClient,
): Promise<DemoReminderRow[]> {
  // Hourly cron: demos scheduled 23–24h from now.
  const { from, to } = windowBounds(
    23 * 60 * 60 * 1000,
    24 * 60 * 60 * 1000,
  );

  const { data, error } = await supabase
    .from('scheduled_demos')
    .select(DEMO_SELECT)
    .eq('status', 'scheduled')
    .is('reminder_24h_sent_at', null)
    .gte('scheduled_at', from)
    .lte('scheduled_at', to);

  if (error) throw error;
  return (data ?? []) as DemoReminderRow[];
}

export async function fetchPending1hReminders(
  supabase: SupabaseClient,
): Promise<DemoReminderRow[]> {
  // Hourly cron: demos scheduled ~1h from now (30–90 min window).
  const { from, to } = windowBounds(30 * 60 * 1000, 90 * 60 * 1000);

  const { data, error } = await supabase
    .from('scheduled_demos')
    .select(DEMO_SELECT)
    .eq('status', 'scheduled')
    .is('reminder_1h_sent_at', null)
    .gte('scheduled_at', from)
    .lte('scheduled_at', to);

  if (error) throw error;
  return (data ?? []) as DemoReminderRow[];
}

async function fetchPendingBookingReminders(
  supabase: SupabaseClient,
  type: '24h' | '1h',
): Promise<DemoBookingReminderRow[]> {
  const { from, to } =
    type === '24h'
      ? windowBounds(23 * 60 * 60 * 1000, 24 * 60 * 60 * 1000)
      : windowBounds(30 * 60 * 1000, 90 * 60 * 1000);
  const flag = type === '24h' ? 'reminder_24h_sent' : 'reminder_1h_sent';

  const { data, error } = await supabase
    .from('demo_bookings')
    .select(BOOKING_SELECT)
    .in('status', [...ACTIVE_BOOKING_STATUSES])
    .eq(flag, false)
    .gte('scheduled_at', from)
    .lte('scheduled_at', to);

  if (error) throw error;
  return (data ?? []) as DemoBookingReminderRow[];
}

export async function fetchPending24hBookingReminders(
  supabase: SupabaseClient,
): Promise<DemoBookingReminderRow[]> {
  return fetchPendingBookingReminders(supabase, '24h');
}

export async function fetchPending1hBookingReminders(
  supabase: SupabaseClient,
): Promise<DemoBookingReminderRow[]> {
  return fetchPendingBookingReminders(supabase, '1h');
}

async function persistChannelResult(
  supabase: SupabaseClient,
  table: 'scheduled_demos' | 'demo_bookings',
  id: string,
  patch: Record<string, string | null>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from(table).update(patch).eq('id', id);
  if (error) console.error(`[demo-reminders] channel update failed | id=${id}`, error);
}

async function sendReminderEmail(params: {
  kind: DemoEmailKind;
  to: string;
  name: string;
  scheduledAt: string;
  meetLink: string;
  timezone: string;
  timezoneLabel: string;
}): Promise<void> {
  const content = {
    kind: params.kind,
    name: params.name,
    scheduledAt: params.scheduledAt,
    meetLink: params.meetLink,
    timezone: params.timezone,
    timezoneLabel: params.timezoneLabel,
  };
  await sendDemoEmailViaResend({
    to: params.to,
    subject: demoEmailSubject(content),
    html: renderDemoEmailHtml(content),
  });
}

async function sendReminder(params: {
  supabase: SupabaseClient;
  demo: DemoReminderRow;
  creds: TwilioCreds;
  type: '24h' | '1h';
  sendFn: SendWhatsAppFn;
  sendTelegram?: SendTelegramFn;
}): Promise<'sent' | 'skipped' | 'failed'> {
  const phone = params.demo.customer_phone?.trim();
  const email = params.demo.customer_email?.trim();
  if (!phone && !email) {
    console.error(`[demo-reminders] skipped | demo_id=${params.demo.id} | reason=no_phone_or_email`);
    return 'skipped';
  }

  const display = await resolveDemoDisplayTimezone(params.supabase, params.demo);
  const demoForSend: DemoReminderRow =
    params.type === '1h'
      ? {
          ...params.demo,
          google_meet_link:
            params.demo.google_meet_link?.trim() ||
            process.env.KALYO_DEMO_MEET_LINK?.trim() ||
            'https://meet.google.com/pgd-dxmb-sfk',
        }
      : params.demo;
  const body =
    params.type === '24h'
      ? formatReminder24h(demoForSend, display)
      : formatReminder1h(demoForSend, display);
  const contentSid =
    params.type === '24h' ? DEMO_REMINDER_24H_TEMPLATE_SID : DEMO_REMINDER_1H_TEMPLATE_SID;
  const contentVariables =
    params.type === '24h'
      ? buildReminder24hContentVariables(demoForSend, display)
      : buildReminder1hContentVariables(demoForSend);

  if (phone && !contentVariables) {
    console.error(
      `[demo-reminders] skipped | demo_id=${params.demo.id} | reason=no_meet_link`,
    );
    return 'skipped';
  }

  const meetLink =
    demoForSend.google_meet_link?.trim() ||
    process.env.KALYO_DEMO_MEET_LINK?.trim() ||
    'https://meet.google.com/pgd-dxmb-sfk';
  const delivery = await deliverDemoChannels({
    email,
    phone,
    sendEmail: email
      ? () =>
          sendReminderEmail({
            kind: params.type === '24h' ? 'reminder_24h' : 'reminder_1h',
            to: email,
            name: params.demo.customer_name,
            scheduledAt: params.demo.scheduled_at,
            meetLink,
            timezone: display.timezone,
            timezoneLabel: display.label,
          })
      : undefined,
    sendWhatsApp:
      phone && contentVariables
        ? () =>
            params.sendFn({
              accountSid: params.creds.accountSid,
              authToken: params.creds.authToken,
              from: params.creds.from,
              to: phone,
              contentSid,
              contentVariables,
            })
        : undefined,
  });

  if (delivery.email === 'failed') {
    console.error(
      `[demo-reminders] email failed | demo_id=${params.demo.id} | type=${params.type} | ${delivery.emailError}`,
    );
  }
  if (delivery.whatsapp === 'failed') {
    console.error(
      `[demo-reminders] whatsapp failed | demo_id=${params.demo.id} | type=${params.type} | ${delivery.whatsappError}`,
    );
  }
  if (delivery.alert && params.sendTelegram) {
    await params.sendTelegram(
      `⚠️ Recordatorio ${params.type} incompleto\n${params.demo.customer_name}\nemail=${delivery.email} whatsapp=${delivery.whatsapp}`,
    );
  }

  const nowIso = new Date().toISOString();
  const column = params.type === '24h' ? 'reminder_24h_sent_at' : 'reminder_1h_sent_at';
  const emailColumn =
    params.type === '24h' ? 'reminder_24h_email_sent_at' : 'reminder_1h_email_sent_at';
  const patch: Record<string, string | null> = {};
  if (delivery.whatsapp === 'sent') patch[column] = nowIso;
  if (delivery.email === 'sent') patch[emailColumn] = nowIso;
  patch.email_error = delivery.emailError;
  patch.whatsapp_error = delivery.whatsappError;
  if (delivery.whatsapp === 'sent') {
    const { error: updateError } = await params.supabase
      .from('scheduled_demos')
      .update({ ...patch, [column]: nowIso })
      .eq('id', params.demo.id)
      .eq('status', 'scheduled')
      .is(column, null);
    if (updateError) {
      console.error(`[demo-reminders] update failed | demo_id=${params.demo.id}`, updateError);
      return 'failed';
    }
  } else {
    await persistChannelResult(params.supabase, 'scheduled_demos', params.demo.id, patch);
  }

  if (delivery.whatsapp !== 'sent' && delivery.email !== 'sent') return 'failed';

  if (delivery.whatsapp === 'sent' && params.demo.conversation_id) {
    await params.supabase.from('messages').insert({
      conversation_id: params.demo.conversation_id,
      role: 'assistant',
      content: body,
      source: 'text',
      source_type: 'claude',
      metadata: { source: `demo_reminder_${params.type}` },
    });
    await params.supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', params.demo.conversation_id);
  }

  if (delivery.whatsapp === 'sent') {
    console.log(
      `[demo-reminders] sent | demo_id=${params.demo.id} | phone=${phone} | type=${params.type}`,
    );
    await notifyDemoReminderEvent(
      params.type === '24h' ? 'reminder_24h_sent' : 'reminder_1h_sent',
      demoForSend,
      {},
      { supabase: params.supabase, sendTelegram: params.sendTelegram },
    );
  } else if (delivery.email === 'sent') {
    console.log(
      `[demo-reminders] email only | demo_id=${params.demo.id} | type=${params.type}`,
    );
  }

  return 'sent';
}

async function markBookingReminderSent(
  supabase: SupabaseClient,
  bookingId: string,
  type: '24h' | '1h',
): Promise<boolean> {
  const column = type === '24h' ? 'reminder_24h_sent' : 'reminder_1h_sent';
  const { error } = await supabase
    .from('demo_bookings')
    .update({ [column]: true })
    .eq('id', bookingId)
    .eq(column, false);

  if (error) {
    console.error(`[demo-reminders] booking update failed | booking_id=${bookingId}`, error);
    return false;
  }
  return true;
}

async function sendBookingReminder(params: {
  supabase: SupabaseClient;
  booking: DemoBookingReminderRow;
  creds: TwilioCreds;
  type: '24h' | '1h';
  sendFn: SendWhatsAppFn;
  sendTelegram?: SendTelegramFn;
}): Promise<'sent' | 'skipped' | 'failed'> {
  const demo = bookingToReminderRow(params.booking);
  const phone = demo.customer_phone?.trim() ?? '';
  const display = await resolveDemoDisplayTimezone(params.supabase, demo);

  if (!phone) {
    if (demo.customer_email?.trim()) {
      try {
        await sendReminderEmail({
          kind: params.type === '24h' ? 'reminder_24h' : 'reminder_1h',
          to: demo.customer_email.trim(),
          name: demo.customer_name,
          scheduledAt: demo.scheduled_at,
          meetLink: resolveMeetLink(params.booking.google_meet_link || params.booking.meet_link),
          timezone: display.timezone,
          timezoneLabel: display.label,
        });
      } catch (err) {
        console.error(
          `[demo-reminders] booking email failed | booking_id=${params.booking.id}`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    console.error(
      `[demo-reminders] booking skipped | booking_id=${params.booking.id} | reason=no_phone`,
    );
    const notified = await notifyDemoReminderEvent(
      params.type === '24h' ? 'reminder_24h_no_phone' : 'reminder_1h_no_phone',
      demo,
      {},
      { display, sendTelegram: params.sendTelegram },
    );
    if (!notified) return 'failed';
    const marked = await markBookingReminderSent(params.supabase, params.booking.id, params.type);
    return marked ? 'skipped' : 'failed';
  }

  const contentSid =
    params.type === '24h' ? DEMO_REMINDER_24H_TEMPLATE_SID : DEMO_REMINDER_1H_TEMPLATE_SID;
  const contentVariables =
    params.type === '24h'
      ? buildReminder24hContentVariables(demo, display)
      : buildReminder1hContentVariables(demo);

  if (!contentVariables) {
    console.error(
      `[demo-reminders] booking skipped | booking_id=${params.booking.id} | reason=no_meet_link`,
    );
    return 'skipped';
  }

  const delivery = await deliverDemoChannels({
    email: demo.customer_email,
    phone,
    sendEmail: demo.customer_email?.trim()
      ? () =>
          sendReminderEmail({
            kind: params.type === '24h' ? 'reminder_24h' : 'reminder_1h',
            to: demo.customer_email.trim(),
            name: demo.customer_name,
            scheduledAt: demo.scheduled_at,
            meetLink: resolveMeetLink(params.booking.google_meet_link || params.booking.meet_link),
            timezone: display.timezone,
            timezoneLabel: display.label,
          })
      : undefined,
    sendWhatsApp: () =>
      params.sendFn({
        accountSid: params.creds.accountSid,
        authToken: params.creds.authToken,
        from: params.creds.from,
        to: phone,
        contentSid,
        contentVariables,
      }),
  });

  if (delivery.email === 'failed') {
    console.error(
      `[demo-reminders] booking email failed | booking_id=${params.booking.id} | ${delivery.emailError}`,
    );
  }
  if (delivery.whatsapp === 'failed') {
    console.error(
      `[demo-reminders] booking send failed | booking_id=${params.booking.id} | type=${params.type} | ${delivery.whatsappError}`,
    );
  }
  if (delivery.alert && params.sendTelegram) {
    await params.sendTelegram(
      `⚠️ Recordatorio ${params.type} incompleto\n${demo.customer_name}\nemail=${delivery.email} whatsapp=${delivery.whatsapp}`,
    );
  }
  const emailColumn =
    params.type === '24h' ? 'reminder_24h_email_sent_at' : 'reminder_1h_email_sent_at';
  await persistChannelResult(params.supabase, 'demo_bookings', params.booking.id, {
    ...(delivery.email === 'sent' ? { [emailColumn]: new Date().toISOString() } : {}),
    email_error: delivery.emailError,
    whatsapp_error: delivery.whatsappError,
  });
  if (delivery.whatsapp !== 'sent') return 'failed';

  const marked = await markBookingReminderSent(params.supabase, params.booking.id, params.type);
  if (!marked) return 'failed';

  console.log(
    `[demo-reminders] booking sent | booking_id=${params.booking.id} | phone=${phone} | type=${params.type}`,
  );

  await notifyDemoReminderEvent(
    params.type === '24h' ? 'reminder_24h_sent' : 'reminder_1h_sent',
    demo,
    {},
    { display, sendTelegram: params.sendTelegram },
  );

  return 'sent';
}

export async function runDemoRemindersCron(params: {
  supabase: SupabaseClient;
  creds: TwilioCreds;
  sendFn?: SendWhatsAppFn;
  sendTelegram?: SendTelegramFn;
}): Promise<{
  pending24h: number;
  pending1h: number;
  sent24h: number;
  sent1h: number;
  failed: number;
  skipped: number;
  bookingsPending24h: number;
  bookingsPending1h: number;
  bookingsSent24h: number;
  bookingsSent1h: number;
}> {
  const sendFn =
    params.sendFn ??
    (async (args: Parameters<SendWhatsAppFn>[0]) => {
      const { sendWhatsApp } = await import('@/lib/twilio');
      await sendWhatsApp(args);
    });
  console.log('[demo-reminders] cron started');

  const pending24h = await fetchPending24hReminders(params.supabase);
  const pending1h = await fetchPending1hReminders(params.supabase);
  const pendingBookings24h = await fetchPending24hBookingReminders(params.supabase);
  const pendingBookings1h = await fetchPending1hBookingReminders(params.supabase);

  console.log(`[demo-reminders] found ${pending24h.length} pending 24h reminders`);
  console.log(`[demo-reminders] found ${pending1h.length} pending 1h reminders`);
  console.log(`[demo-reminders] found ${pendingBookings24h.length} pending booking 24h reminders`);
  console.log(`[demo-reminders] found ${pendingBookings1h.length} pending booking 1h reminders`);

  let sent24h = 0;
  let sent1h = 0;
  let failed = 0;
  let skipped = 0;
  let bookingsSent24h = 0;
  let bookingsSent1h = 0;

  for (const demo of pending24h) {
    const result = await sendReminder({
      supabase: params.supabase,
      demo,
      creds: params.creds,
      type: '24h',
      sendFn,
      sendTelegram: params.sendTelegram,
    });
    if (result === 'sent') sent24h++;
    else if (result === 'failed') failed++;
    else skipped++;
  }

  for (const demo of pending1h) {
    const result = await sendReminder({
      supabase: params.supabase,
      demo,
      creds: params.creds,
      type: '1h',
      sendFn,
      sendTelegram: params.sendTelegram,
    });
    if (result === 'sent') sent1h++;
    else if (result === 'failed') failed++;
    else skipped++;
  }

  for (const booking of pendingBookings24h) {
    const result = await sendBookingReminder({
      supabase: params.supabase,
      booking,
      creds: params.creds,
      type: '24h',
      sendFn,
      sendTelegram: params.sendTelegram,
    });
    if (result === 'sent') bookingsSent24h++;
    else if (result === 'failed') failed++;
    else skipped++;
  }

  for (const booking of pendingBookings1h) {
    const result = await sendBookingReminder({
      supabase: params.supabase,
      booking,
      creds: params.creds,
      type: '1h',
      sendFn,
      sendTelegram: params.sendTelegram,
    });
    if (result === 'sent') bookingsSent1h++;
    else if (result === 'failed') failed++;
    else skipped++;
  }

  return {
    pending24h: pending24h.length,
    pending1h: pending1h.length,
    sent24h,
    sent1h,
    failed,
    skipped,
    bookingsPending24h: pendingBookings24h.length,
    bookingsPending1h: pendingBookings1h.length,
    bookingsSent24h,
    bookingsSent1h,
  };
}
