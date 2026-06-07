import type { SupabaseClient } from '@supabase/supabase-js';
import { formatOnboardingMessage } from '@/lib/trial-onboarding-messages';
import {
  notifyTrialOnboardingSent,
  type SendTelegramFn,
} from '@/lib/trial-onboarding-notifications';

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
  body: string;
}) => Promise<void>;

export type TrialOnboardingRow = {
  id: string;
  customer_phone: string;
  trial_user_email: string;
  trial_user_name: string | null;
  trial_started_at: string;
  trial_ends_at: string;
  conversation_id: string | null;
  day_1_sent_at: string | null;
  day_3_sent_at: string | null;
  day_7_sent_at: string | null;
  day_13_sent_at: string | null;
  day_15_sent_at: string | null;
};

export type OnboardingDay = 1 | 3 | 7 | 13 | 15;

const ROW_SELECT =
  'id, customer_phone, trial_user_email, trial_user_name, trial_started_at, trial_ends_at, conversation_id, day_1_sent_at, day_3_sent_at, day_7_sent_at, day_13_sent_at, day_15_sent_at';

const DAY_CONFIG: Record<
  OnboardingDay,
  { column: keyof TrialOnboardingRow; minHoursAgo: number; maxHoursAgo: number }
> = {
  1: { column: 'day_1_sent_at', minHoursAgo: 23, maxHoursAgo: 25 },
  3: { column: 'day_3_sent_at', minHoursAgo: 71, maxHoursAgo: 73 },
  7: { column: 'day_7_sent_at', minHoursAgo: 167, maxHoursAgo: 169 },
  13: { column: 'day_13_sent_at', minHoursAgo: 311, maxHoursAgo: 313 },
  15: { column: 'day_15_sent_at', minHoursAgo: 359, maxHoursAgo: 361 },
};

function startedAtWindow(minHoursAgo: number, maxHoursAgo: number): { from: string; to: string } {
  const now = Date.now();
  return {
    from: new Date(now - maxHoursAgo * 60 * 60 * 1000).toISOString(),
    to: new Date(now - minHoursAgo * 60 * 60 * 1000).toISOString(),
  };
}

export async function fetchPendingOnboardingDay(
  supabase: SupabaseClient,
  day: OnboardingDay,
): Promise<TrialOnboardingRow[]> {
  const config = DAY_CONFIG[day];
  const { from, to } = startedAtWindow(config.minHoursAgo, config.maxHoursAgo);

  const { data, error } = await supabase
    .from('trial_onboarding_messages')
    .select(ROW_SELECT)
    .is(config.column, null)
    .eq('unsubscribed', false)
    .is('upgraded_to_paid_at', null)
    .gte('trial_started_at', from)
    .lte('trial_started_at', to);

  if (error) throw error;
  return (data ?? []) as TrialOnboardingRow[];
}

async function sendOnboardingDay(params: {
  supabase: SupabaseClient;
  row: TrialOnboardingRow;
  day: OnboardingDay;
  creds: TwilioCreds;
  sendFn: SendWhatsAppFn;
  sendTelegram?: SendTelegramFn;
}): Promise<'sent' | 'skipped' | 'failed'> {
  const phone = params.row.customer_phone?.trim();
  if (!phone) {
    console.error(`[trial-onboarding] skipped | day=${params.day} | reason=no_phone`);
    return 'skipped';
  }

  const body = formatOnboardingMessage(
    params.day,
    {
      trial_user_name: params.row.trial_user_name,
      trial_user_email: params.row.trial_user_email,
    },
    params.row.trial_ends_at,
  );

  try {
    await params.sendFn({
      accountSid: params.creds.accountSid,
      authToken: params.creds.authToken,
      from: params.creds.from,
      to: phone,
      body,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(
      `[trial-onboarding] failed to send | day=${params.day} | id=${params.row.id} | error=${error}`,
    );
    return 'failed';
  }

  const column = DAY_CONFIG[params.day].column;
  const { error: updateError } = await params.supabase
    .from('trial_onboarding_messages')
    .update({ [column]: new Date().toISOString() })
    .eq('id', params.row.id)
    .is(column, null)
    .eq('unsubscribed', false)
    .is('upgraded_to_paid_at', null);

  if (updateError) {
    console.error(`[trial-onboarding] update failed | day=${params.day} | id=${params.row.id}`, updateError);
    return 'failed';
  }

  if (params.row.conversation_id) {
    await params.supabase.from('messages').insert({
      conversation_id: params.row.conversation_id,
      role: 'assistant',
      content: body,
      source: 'text',
      source_type: 'claude',
      metadata: { source: `trial_onboarding_day_${params.day}` },
    });
    await params.supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', params.row.conversation_id);
  }

  console.log(
    `[trial-onboarding] sent | day=${params.day} | phone=${phone} | email=${params.row.trial_user_email}`,
  );

  await notifyTrialOnboardingSent({
    day: params.day,
    demoId: params.row.id,
    name: params.row.trial_user_name,
    email: params.row.trial_user_email,
    trialEndsAt: params.row.trial_ends_at,
    sendTelegram: params.sendTelegram,
  });

  return 'sent';
}

export async function runTrialOnboardingCron(params: {
  supabase: SupabaseClient;
  creds: TwilioCreds;
  sendFn?: SendWhatsAppFn;
  sendTelegram?: SendTelegramFn;
}): Promise<Record<string, number>> {
  const sendFn =
    params.sendFn ??
    (async (args: Parameters<SendWhatsAppFn>[0]) => {
      const { sendWhatsApp } = await import('@/lib/twilio');
      await sendWhatsApp(args);
    });

  console.log('[trial-onboarding] cron started');

  const summary: Record<string, number> = {
    failed: 0,
    skipped: 0,
  };

  for (const day of [1, 3, 7, 13, 15] as const) {
    const pending = await fetchPendingOnboardingDay(params.supabase, day);
    console.log(`[trial-onboarding] found ${pending.length} pending day${day}`);
    summary[`pending_day${day}`] = pending.length;
    summary[`sent_day${day}`] = 0;

    for (const row of pending) {
      const result = await sendOnboardingDay({
        supabase: params.supabase,
        row,
        day,
        creds: params.creds,
        sendFn,
        sendTelegram: params.sendTelegram,
      });
      if (result === 'sent') summary[`sent_day${day}`]++;
      else if (result === 'failed') summary.failed++;
      else summary.skipped++;
    }
  }

  return summary;
}
