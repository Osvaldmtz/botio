import type { SupabaseClient } from '@supabase/supabase-js';
import {
  formatDay9NoCoupon,
  formatDay9WithCoupon,
  formatOnboardingMessage,
  type OnboardingNarrativeDay,
} from '@/lib/trial-onboarding-messages';
import { evaluateDay9Eligibility } from '@/lib/trial-onboarding-day9-eligibility';
import { KALYO_PRICING } from '@/lib/kalyo-pricing-data';
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
  unsubscribed: boolean;
  upgraded_to_paid_at: string | null;
  day_1_sent_at: string | null;
  day_2_sent_at: string | null;
  day_3_sent_at: string | null;
  day_7_sent_at: string | null;
  day_13_sent_at: string | null;
  day_15_sent_at: string | null;
  day_9_sent_at: string | null;
  day_9_status: string | null;
};

/** Cron-driven narrative days (day 1 welcome is sent at enroll). */
export type OnboardingCronDay = 2 | 3 | 5 | 6 | 7 | 9;

const ROW_SELECT =
  'id, customer_phone, trial_user_email, trial_user_name, trial_started_at, trial_ends_at, conversation_id, unsubscribed, upgraded_to_paid_at, day_1_sent_at, day_2_sent_at, day_3_sent_at, day_7_sent_at, day_13_sent_at, day_15_sent_at, day_9_sent_at, day_9_status';

type CronDayConfig = {
  narrativeDay: OnboardingNarrativeDay;
  column: keyof TrialOnboardingRow;
  minHoursAgo: number;
  maxHoursAgo: number;
};

/**
 * Legacy DB columns → narrative day timing from trial_started_at:
 * day_2 → 24h | day_3 → 72h | day_7 → 120h (d5) | day_13 → 144h (d6) | day_15 → 168h (d7) | day_9 → 216h
 */
const CRON_DAY_CONFIG: Record<OnboardingCronDay, CronDayConfig> = {
  2: { narrativeDay: 2, column: 'day_2_sent_at', minHoursAgo: 23, maxHoursAgo: 25 },
  3: { narrativeDay: 3, column: 'day_3_sent_at', minHoursAgo: 71, maxHoursAgo: 73 },
  5: { narrativeDay: 5, column: 'day_7_sent_at', minHoursAgo: 119, maxHoursAgo: 121 },
  6: { narrativeDay: 6, column: 'day_13_sent_at', minHoursAgo: 143, maxHoursAgo: 145 },
  7: { narrativeDay: 7, column: 'day_15_sent_at', minHoursAgo: 167, maxHoursAgo: 169 },
  9: { narrativeDay: 9, column: 'day_9_sent_at', minHoursAgo: 215, maxHoursAgo: 217 },
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
  day: OnboardingCronDay,
): Promise<TrialOnboardingRow[]> {
  const config = CRON_DAY_CONFIG[day];
  const { from, to } = startedAtWindow(config.minHoursAgo, config.maxHoursAgo);

  let query = supabase
    .from('trial_onboarding_messages')
    .select(ROW_SELECT)
    .is(config.column, null)
    .eq('unsubscribed', false)
    .is('upgraded_to_paid_at', null)
    .gte('trial_started_at', from)
    .lte('trial_started_at', to);

  if (day === 9) {
    query = query.is('day_9_status', null).lt('trial_ends_at', new Date().toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TrialOnboardingRow[];
}

function buildMessageBody(
  day: OnboardingCronDay,
  row: TrialOnboardingRow,
  variant?: 'coupon' | 'no_coupon',
): string {
  const user = {
    trial_user_name: row.trial_user_name,
    trial_user_email: row.trial_user_email,
  };

  if (day === 9) {
    return variant === 'no_coupon' ? formatDay9NoCoupon(user) : formatDay9WithCoupon(user);
  }

  return formatOnboardingMessage(CRON_DAY_CONFIG[day].narrativeDay, user, row.trial_ends_at);
}

async function sendOnboardingDay(params: {
  supabase: SupabaseClient;
  row: TrialOnboardingRow;
  day: OnboardingCronDay;
  creds: TwilioCreds;
  sendFn: SendWhatsAppFn;
  sendTelegram?: SendTelegramFn;
  day9Status?: string;
  messageMetadata?: Record<string, unknown>;
}): Promise<'sent' | 'skipped' | 'failed'> {
  const phone = params.row.customer_phone?.trim();
  if (!phone) {
    console.error(`[trial-onboarding] skipped | day=${params.day} | reason=no_phone`);
    return 'skipped';
  }

  const body = buildMessageBody(
    params.day,
    params.row,
    params.day9Status === 'sent_no_coupon' ? 'no_coupon' : 'coupon',
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

  const config = CRON_DAY_CONFIG[params.day];
  const now = new Date().toISOString();
  const updatePayload: Record<string, string | null> = {
    [config.column]: now,
  };
  if (params.day === 9 && params.day9Status) {
    updatePayload.day_9_status = params.day9Status;
  }

  const { error: updateError } = await params.supabase
    .from('trial_onboarding_messages')
    .update(updatePayload)
    .eq('id', params.row.id)
    .is(config.column, null)
    .eq('unsubscribed', false)
    .is('upgraded_to_paid_at', null);

  if (updateError) {
    console.error(`[trial-onboarding] update failed | day=${params.day} | id=${params.row.id}`, updateError);
    return 'failed';
  }

  if (params.row.conversation_id) {
    const metadata: Record<string, unknown> = {
      source: `trial_onboarding_day_${params.day}`,
      ...params.messageMetadata,
    };

    await params.supabase.from('messages').insert({
      conversation_id: params.row.conversation_id,
      role: 'assistant',
      content: body,
      source: 'text',
      source_type: 'claude',
      metadata,
    });
    await params.supabase
      .from('conversations')
      .update({ last_message_at: now })
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

async function processDay9Row(params: {
  supabase: SupabaseClient;
  row: TrialOnboardingRow;
  creds: TwilioCreds;
  sendFn: SendWhatsAppFn;
  sendTelegram?: SendTelegramFn;
}): Promise<'sent' | 'skipped' | 'failed'> {
  const eligibility = await evaluateDay9Eligibility(params.supabase, params.row);

  if (eligibility.action === 'skip') {
    await params.supabase
      .from('trial_onboarding_messages')
      .update({
        day_9_status: eligibility.status,
        day_9_sent_at: new Date().toISOString(),
      })
      .eq('id', params.row.id)
      .is('day_9_sent_at', null);

    console.log(
      `[trial-onboarding] day9 skipped | id=${params.row.id} | reason=${eligibility.reason}`,
    );
    return 'skipped';
  }

  const withCoupon = eligibility.action === 'send_coupon';
  const messageMetadata = withCoupon
    ? {
        coupon_offered: true,
        coupon_code: KALYO_PRICING.discount.code,
      }
    : undefined;

  return sendOnboardingDay({
    ...params,
    day: 9,
    day9Status: withCoupon ? 'sent_coupon' : 'sent_no_coupon',
    messageMetadata,
  });
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

  for (const day of [2, 3, 5, 6, 7, 9] as const) {
    const pending = await fetchPendingOnboardingDay(params.supabase, day);
    console.log(`[trial-onboarding] found ${pending.length} pending day${day}`);
    summary[`pending_day${day}`] = pending.length;
    summary[`sent_day${day}`] = 0;

    for (const row of pending) {
      const result =
        day === 9
          ? await processDay9Row({
              supabase: params.supabase,
              row,
              creds: params.creds,
              sendFn,
              sendTelegram: params.sendTelegram,
            })
          : await sendOnboardingDay({
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

/** Mark day 1 welcome as sent when enrollment delivers credentials. */
export async function markDay1WelcomeSent(
  supabase: SupabaseClient,
  enrollmentId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from('trial_onboarding_messages')
    .update({ day_1_sent_at: now })
    .eq('id', enrollmentId)
    .is('day_1_sent_at', null);
}
