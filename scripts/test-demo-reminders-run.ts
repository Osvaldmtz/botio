import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal(): void {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const botId = process.env.KALYO_BOT_ID ?? '64f6eed2-1522-48fe-a2c6-f858b767df06';

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const testPhone = `+5299901${String(Date.now()).slice(-5)}`;
const sentMessages: Array<{ to: string; body: string }> = [];

async function cleanup(): Promise<void> {
  const { data: convs } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_phone', testPhone);
  const convIds = (convs ?? []).map((c) => c.id);
  if (convIds.length) {
    await supabase.from('messages').delete().in('conversation_id', convIds);
    await supabase.from('scheduled_demos').delete().in('conversation_id', convIds);
    await supabase.from('conversations').delete().in('id', convIds);
  }
  await supabase.from('scheduled_demos').delete().eq('customer_phone', testPhone);
}

async function ensureConversation(): Promise<string> {
  const { data, error } = await supabase
    .from('conversations')
    .upsert(
      { bot_id: botId, customer_phone: testPhone, channel: 'whatsapp' },
      { onConflict: 'bot_id,customer_phone' },
    )
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('conversation upsert failed');
  return data.id as string;
}

async function insertDemo(params: {
  conversationId: string;
  scheduledAt: Date;
  reminder24h?: boolean;
  reminder1h?: boolean;
}): Promise<string> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('scheduled_demos')
    .insert({
      conversation_id: params.conversationId,
      bot_id: botId,
      customer_email: 'reminder-test@example.com',
      customer_name: 'Reminder Test',
      customer_phone: testPhone,
      scheduled_at: params.scheduledAt.toISOString(),
      status: 'scheduled',
      reminder_24h_sent_at: params.reminder24h ? now : null,
      reminder_1h_sent_at: params.reminder1h ? now : null,
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('demo insert failed');
  return data.id as string;
}

import { parseReminderResponseChoice } from '../lib/demo-flow-parsing';
import {
  buildDemoReminderTelegramText,
  type DemoReminderNotifyEvent,
} from '../lib/demo-reminder-notifications';
import {
  fetchPending1hReminders,
  fetchPending24hReminders,
  runDemoRemindersCron,
} from '../lib/demo-reminders-cron';
import {
  handleDemoReminderResponse,
  shouldInterceptDemoReminderResponse,
} from '../lib/demo-reminder-response';

const telegramCalls: Array<{ event: DemoReminderNotifyEvent; demoId: string; text: string }> = [];

async function runTests(): Promise<void> {
  const display = { timezone: 'America/Mexico_City', label: 'CDMX' };
  const sampleDemo = {
    id: 'demo-sample',
    conversation_id: null,
    customer_name: 'Test User',
    customer_email: 'test@example.com',
    customer_phone: '+52999000000',
    scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    google_meet_link: 'https://meet.google.com/abc-defg-hij',
  };

  for (const event of [
    'reminder_24h_sent',
    'reminder_1h_sent',
    'customer_confirmed',
    'customer_requested_reschedule',
    'customer_cancelled',
  ] as const) {
    const text = buildDemoReminderTelegramText(
      event,
      sampleDemo,
      display,
      event === 'customer_cancelled'
        ? { cancellation_reason: 'cancelled_by_customer_via_reminder' }
        : undefined,
    );
    assert(text.includes('Test User'), `template ${event} includes customer name`);
    assert(text.length > 20, `template ${event} not empty`);
  }

  console.log('Demo reminders tests\n');
  await cleanup();
  telegramCalls.length = 0;

  assert(parseReminderResponseChoice('1') === 1, 'parse 1');
  assert(parseReminderResponseChoice('3') === 3, 'parse 3');
  assert(parseReminderResponseChoice('hola') === null, 'ignore non-choice');

  const conversationId = await ensureConversation();
  const mockCreds = { accountSid: 'ACtest', authToken: 'test', from: 'whatsapp:+10000000000' };
  const mockSend = async (args: { to: string; body: string }) => {
    sentMessages.push({ to: args.to, body: args.body });
  };

  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const demo24Id = await insertDemo({ conversationId, scheduledAt: in24h });

  const pending24 = await fetchPending24hReminders(supabase);
  assert(pending24.some((d) => d.id === demo24Id), '24h demo in pending window');

  sentMessages.length = 0;
  telegramCalls.length = 0;
  const cron24 = await runDemoRemindersCron({
    supabase,
    creds: mockCreds,
    sendFn: async (args) => mockSend({ to: args.to, body: args.body }),
    sendTelegram: async (text) => {
      telegramCalls.push({ event: 'reminder_24h_sent', demoId: demo24Id, text });
    },
  });
  assert(cron24.sent24h >= 1, '24h reminder sent');
  assert(sentMessages.length >= 1, 'mock twilio received message');
  assert(
    telegramCalls.some((c) => c.event === 'reminder_24h_sent' && c.demoId === demo24Id),
    '24h telegram notify fired',
  );
  assert(
    telegramCalls.some((c) => c.text.includes('Recordatorio 24h enviado')),
    '24h telegram payload correct',
  );

  const { data: after24 } = await supabase
    .from('scheduled_demos')
    .select('reminder_24h_sent_at')
    .eq('id', demo24Id)
    .single();
  assert(after24?.reminder_24h_sent_at != null, 'reminder_24h_sent_at set');

  sentMessages.length = 0;
  const cron24Again = await runDemoRemindersCron({
    supabase,
    creds: mockCreds,
    sendFn: async (args) => mockSend({ to: args.to, body: args.body }),
  });
  assert(sentMessages.length === 0, '24h idempotent — no re-send');
  assert(cron24Again.sent24h === 0, 'no second 24h send');

  await supabase.from('scheduled_demos').delete().eq('id', demo24Id);

  const in1h = new Date(Date.now() + 60 * 60 * 1000);
  const demo1hId = await insertDemo({ conversationId, scheduledAt: in1h });

  const pending1h = await fetchPending1hReminders(supabase);
  assert(pending1h.some((d) => d.id === demo1hId), '1h demo in pending window');

  sentMessages.length = 0;
  telegramCalls.length = 0;
  const cron1h = await runDemoRemindersCron({
    supabase,
    creds: mockCreds,
    sendFn: async (args) => mockSend({ to: args.to, body: args.body }),
    sendTelegram: async (text) => {
      telegramCalls.push({ event: 'reminder_1h_sent', demoId: demo1hId, text });
    },
  });
  assert(cron1h.sent1h >= 1, '1h reminder sent');
  assert(
    telegramCalls.some((c) => c.event === 'reminder_1h_sent' && c.demoId === demo1hId),
    '1h telegram notify fired',
  );

  const { data: after1h } = await supabase
    .from('scheduled_demos')
    .select('reminder_1h_sent_at')
    .eq('id', demo1hId)
    .single();
  assert(after1h?.reminder_1h_sent_at != null, 'reminder_1h_sent_at set');

  await supabase
    .from('scheduled_demos')
    .update({ reminder_24h_sent_at: new Date().toISOString() })
    .eq('id', demo1hId);

  const reminderDemo = await shouldInterceptDemoReminderResponse(supabase, testPhone, '1');
  assert(reminderDemo?.id === demo1hId, 'intercept reminder response');

  telegramCalls.length = 0;
  const confirmResult = await handleDemoReminderResponse({
    supabase,
    conversationId,
    customerPhone: testPhone,
    messageBody: '1',
    demo: reminderDemo!,
    creds: null,
    sendTelegram: async (text) => {
      telegramCalls.push({ event: 'customer_confirmed', demoId: demo1hId, text });
    },
  });
  assert(confirmResult.reminderResponse === 'confirmed', 'confirm response');
  assert(
    telegramCalls.some((c) => c.event === 'customer_confirmed'),
    'confirm telegram notify fired',
  );

  const { data: confirmed } = await supabase
    .from('scheduled_demos')
    .select('confirmed_by_customer_at, reminder_response')
    .eq('id', demo1hId)
    .single();
  assert(confirmed?.confirmed_by_customer_at != null, 'confirmed_by_customer_at set');
  assert(confirmed?.reminder_response === 'confirmed', 'reminder_response confirmed');

  await supabase.from('scheduled_demos').delete().eq('id', demo1hId);

  const cancelDemoId = await insertDemo({
    conversationId,
    scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    reminder1h: true,
  });
  const cancelDemo = await shouldInterceptDemoReminderResponse(supabase, testPhone, '3');
  assert(cancelDemo?.id === cancelDemoId, 'intercept cancel');

  telegramCalls.length = 0;
  await handleDemoReminderResponse({
    supabase,
    conversationId,
    customerPhone: testPhone,
    messageBody: '3',
    demo: cancelDemo!,
    creds: null,
    sendTelegram: async (text) => {
      telegramCalls.push({ event: 'customer_cancelled', demoId: cancelDemoId, text });
    },
  });
  assert(
    telegramCalls.some((c) => c.event === 'customer_cancelled'),
    'cancel telegram notify fired',
  );

  const failTelegramDemoId = await insertDemo({
    conversationId,
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  sentMessages.length = 0;
  const cronDespiteTelegramFail = await runDemoRemindersCron({
    supabase,
    creds: mockCreds,
    sendFn: async (args) => mockSend({ to: args.to, body: args.body }),
    sendTelegram: async () => {
      throw new Error('telegram down');
    },
  });
  assert(cronDespiteTelegramFail.sent24h >= 1, 'whatsapp still sent when telegram fails');
  const { data: despiteFail } = await supabase
    .from('scheduled_demos')
    .select('reminder_24h_sent_at')
    .eq('id', failTelegramDemoId)
    .single();
  assert(despiteFail?.reminder_24h_sent_at != null, 'reminder still marked sent on telegram fail');
  await supabase.from('scheduled_demos').delete().eq('id', failTelegramDemoId);

  const { data: cancelled } = await supabase
    .from('scheduled_demos')
    .select('status, reminder_response, cancellation_reason')
    .eq('id', cancelDemoId)
    .single();
  assert(cancelled?.status === 'cancelled', 'status cancelled');
  assert(cancelled?.reminder_response === 'cancelled', 'reminder_response cancelled');
  assert(
    cancelled?.cancellation_reason === 'cancelled_by_customer_via_reminder',
    'cancellation reason',
  );

  await cleanup();
  console.log('✓ All demo reminders tests passed');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
