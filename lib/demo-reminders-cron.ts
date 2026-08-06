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

async function sendReminder(params: {
  supabase: SupabaseClient;
  demo: DemoReminderRow;
  creds: TwilioCreds;
  type: '24h' | '1h';
  sendFn: SendWhatsAppFn;
  sendTelegram?: SendTelegramFn;
}): Promise<'sent' | 'skipped' | 'failed'> {
  const phone = params.demo.customer_phone?.trim();
  if (!phone) {
    console.error(`[demo-reminders] skipped | demo_id=${params.demo.id} | reason=no_phone`);
    return 'skipped';
  }

  const display = await resolveDemoDisplayTimezone(params.supabase, params.demo);
  const body =
    params.type === '24h'
      ? formatReminder24h(params.demo, display)
      : formatReminder1h(params.demo, display);
  const contentSid =
    params.type === '24h' ? DEMO_REMINDER_24H_TEMPLATE_SID : DEMO_REMINDER_1H_TEMPLATE_SID;
  const contentVariables =
    params.type === '24h'
      ? buildReminder24hContentVariables(params.demo, display)
      : buildReminder1hContentVariables(params.demo);

  if (!contentVariables) {
    console.error(
      `[demo-reminders] skipped | demo_id=${params.demo.id} | reason=no_meet_link`,
    );
    return 'skipped';
  }

  try {
    await params.sendFn({
      accountSid: params.creds.accountSid,
      authToken: params.creds.authToken,
      from: params.creds.from,
      to: phone,
      contentSid,
      contentVariables,
    });
  } catch (err) {
    console.error(`[demo-reminders] send failed | demo_id=${params.demo.id} | type=${params.type}`, err);
    return 'failed';
  }

  const column = params.type === '24h' ? 'reminder_24h_sent_at' : 'reminder_1h_sent_at';
  const { error: updateError } = await params.supabase
    .from('scheduled_demos')
    .update({ [column]: new Date().toISOString() })
    .eq('id', params.demo.id)
    .eq('status', 'scheduled')
    .is(column, null);

  if (updateError) {
    console.error(`[demo-reminders] update failed | demo_id=${params.demo.id}`, updateError);
    return 'failed';
  }

  if (params.demo.conversation_id) {
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

  console.log(
    `[demo-reminders] sent | demo_id=${params.demo.id} | phone=${phone} | type=${params.type}`,
  );

  await notifyDemoReminderEvent(
    params.type === '24h' ? 'reminder_24h_sent' : 'reminder_1h_sent',
    params.demo,
    {},
    { supabase: params.supabase, sendTelegram: params.sendTelegram },
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

  console.log(`[demo-reminders] found ${pending24h.length} pending 24h reminders`);
  console.log(`[demo-reminders] found ${pending1h.length} pending 1h reminders`);

  let sent24h = 0;
  let sent1h = 0;
  let failed = 0;
  let skipped = 0;

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

  return {
    pending24h: pending24h.length,
    pending1h: pending1h.length,
    sent24h,
    sent1h,
    failed,
    skipped,
  };
}
