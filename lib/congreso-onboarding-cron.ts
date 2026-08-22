import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CONGRESO_MESSAGES,
  CONGRESO_ONBOARDING,
  getKalyoAppUrl,
} from '@/lib/congreso-messages';
import type { SendWhatsAppFn, TwilioCreds } from '@/lib/demo-reminders-cron';

/**
 * Congreso onboarding drip via Twilio Content Template (HSM).
 *
 * Register in Twilio Console → Messaging → Content Template Builder:
 *   Name: kalyo_congreso_onboarding | Language: Spanish (MX) | Type: UTILITY
 *   Body: {{1}}, {{2}} Ingresa aquí: {{3}}
 * After Meta approval, set TWILIO_CONGRESO_ONBOARDING_CONTENT_SID=HX…
 *
 * Day 1 (credentials) is sent free-form from congreso-handler at activation —
 * this cron skips day 1 sends and only sends template days 3+.
 */

export type CongresoTrialRow = {
  id: string;
  conversation_id: string | null;
  customer_phone: string;
  name: string;
  email: string;
  bot_id: string;
  activated_at: string;
  expires_at: string;
  generated_password?: string | null;
  day_1_sent_at: string | null;
  day_3_sent_at: string | null;
  day_7_sent_at: string | null;
  day_12_sent_at: string | null;
  day_17_sent_at: string | null;
  day_25_sent_at: string | null;
  day_29_sent_at: string | null;
  day_30_sent_at: string | null;
};

export type CongresoCronPlanItem = {
  trialId: string;
  email: string;
  day: number;
  phone: string;
  messagePreview: string;
  wouldSend: boolean;
  reason?: string;
};

const ROW_SELECT =
  'id, conversation_id, customer_phone, name, email, bot_id, activated_at, expires_at, generated_password, day_1_sent_at, day_3_sent_at, day_7_sent_at, day_12_sent_at, day_17_sent_at, day_25_sent_at, day_29_sent_at, day_30_sent_at';

function daySentColumn(day: number): keyof CongresoTrialRow {
  return `day_${day}_sent_at` as keyof CongresoTrialRow;
}

export function daysSinceActivation(activatedAt: string, now = new Date()): number {
  const start = new Date(activatedAt).getTime();
  return Math.floor((now.getTime() - start) / 86_400_000);
}

export async function fetchActiveCongresoTrials(
  supabase: SupabaseClient,
): Promise<CongresoTrialRow[]> {
  const { data, error } = await supabase
    .from('congreso_trials')
    .select(ROW_SELECT)
    .gt('expires_at', new Date().toISOString());

  if (error) throw error;
  return (data ?? []) as CongresoTrialRow[];
}

function buildStoredMessageBody(name: string, dayMessage: string, appUrl: string): string {
  return `${name}, ${dayMessage} Ingresa aquí: ${appUrl}`;
}

export function buildCongresoDay1CredentialsMessage(row: {
  name: string;
  email: string;
  generated_password?: string | null;
}): string {
  return CONGRESO_MESSAGES.confirmed({
    name: row.name,
    email: row.email,
    password: row.generated_password ?? '(missing)',
    url: getKalyoAppUrl(),
  });
}

/**
 * Plans which onboarding messages would be sent for active trials.
 * Day 1 is included as a credentials preview (already sent at activation).
 * Days 3+ are HSM template sends.
 */
export async function planCongresoOnboarding(params: {
  supabase: SupabaseClient;
  now?: Date;
  contentSid?: string | null;
  /** Limit planning to a single trial email (QA). */
  emailFilter?: string;
}): Promise<CongresoCronPlanItem[]> {
  const now = params.now ?? new Date();
  const appUrl = getKalyoAppUrl();
  const contentSid =
    params.contentSid ?? process.env.TWILIO_CONGRESO_ONBOARDING_CONTENT_SID?.trim() ?? '';

  let trials = await fetchActiveCongresoTrials(params.supabase);
  if (params.emailFilter) {
    const target = params.emailFilter.toLowerCase();
    trials = trials.filter((t) => t.email.toLowerCase() === target);
  }

  const planned: CongresoCronPlanItem[] = [];

  for (const row of trials) {
    const elapsed = daysSinceActivation(row.activated_at, now);

    for (const entry of CONGRESO_ONBOARDING) {
      if (entry.day === 1) {
        planned.push({
          trialId: row.id,
          email: row.email,
          day: 1,
          phone: row.customer_phone,
          messagePreview: buildCongresoDay1CredentialsMessage(row),
          wouldSend: false,
          reason: 'day_1_sent_at_activation',
        });
        continue;
      }

      const column = daySentColumn(entry.day);
      if (elapsed < entry.day) {
        planned.push({
          trialId: row.id,
          email: row.email,
          day: entry.day,
          phone: row.customer_phone,
          messagePreview: buildStoredMessageBody(row.name, entry.message, appUrl),
          wouldSend: false,
          reason: `elapsed_${elapsed}_lt_${entry.day}`,
        });
        continue;
      }

      if (row[column]) {
        planned.push({
          trialId: row.id,
          email: row.email,
          day: entry.day,
          phone: row.customer_phone,
          messagePreview: buildStoredMessageBody(row.name, entry.message, appUrl),
          wouldSend: false,
          reason: 'already_sent',
        });
        continue;
      }

      if (!contentSid) {
        planned.push({
          trialId: row.id,
          email: row.email,
          day: entry.day,
          phone: row.customer_phone,
          messagePreview: buildStoredMessageBody(row.name, entry.message, appUrl),
          wouldSend: false,
          reason: 'missing_content_sid',
        });
        continue;
      }

      planned.push({
        trialId: row.id,
        email: row.email,
        day: entry.day,
        phone: row.customer_phone,
        messagePreview: buildStoredMessageBody(row.name, entry.message, appUrl),
        wouldSend: true,
      });
    }
  }

  return planned;
}

async function sendCongresoDay(params: {
  supabase: SupabaseClient;
  row: CongresoTrialRow;
  day: number;
  message: string;
  creds: TwilioCreds;
  sendFn: SendWhatsAppFn;
  contentSid: string;
  appUrl: string;
}): Promise<'sent' | 'skipped' | 'failed'> {
  const phone = params.row.customer_phone?.trim();
  if (!phone) {
    console.error(`[congreso-onboarding] skipped | day=${params.day} | reason=no_phone`);
    return 'skipped';
  }

  const column = daySentColumn(params.day);
  if (params.row[column]) {
    return 'skipped';
  }

  const contentVariables = {
    '1': params.row.name,
    '2': params.message,
    '3': params.appUrl,
  };
  const storedBody = buildStoredMessageBody(
    params.row.name,
    params.message,
    params.appUrl,
  );

  try {
    await params.sendFn({
      accountSid: params.creds.accountSid,
      authToken: params.creds.authToken,
      from: params.creds.from,
      to: phone,
      contentSid: params.contentSid,
      contentVariables,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(
      `[congreso-onboarding] failed to send | day=${params.day} | id=${params.row.id} | error=${error}`,
    );
    return 'failed';
  }

  const now = new Date().toISOString();
  const { error: updateError } = await params.supabase
    .from('congreso_trials')
    .update({ [column]: now })
    .eq('id', params.row.id)
    .is(column, null);

  if (updateError) {
    console.error(
      `[congreso-onboarding] update failed | day=${params.day} | id=${params.row.id}`,
      updateError,
    );
    return 'failed';
  }

  if (params.row.conversation_id) {
    await params.supabase.from('messages').insert({
      conversation_id: params.row.conversation_id,
      role: 'assistant',
      content: storedBody,
      source: 'text',
      source_type: 'claude',
      metadata: {
        source: `congreso_onboarding_day_${params.day}`,
        content_sid: params.contentSid,
      },
    });
    await params.supabase
      .from('conversations')
      .update({ last_message_at: now })
      .eq('id', params.row.conversation_id);
  }

  console.log(
    `[congreso-onboarding] sent | day=${params.day} | phone=${phone} | email=${params.row.email}`,
  );

  return 'sent';
}

export type CongresoCronResult = {
  active_trials: number;
  sent?: number;
  skipped?: number;
  failed?: number;
  planned_count?: number;
  would_send?: number;
  planned?: CongresoCronPlanItem[];
  [key: string]: number | CongresoCronPlanItem[] | undefined;
};

export async function runCongresoOnboardingCron(params: {
  supabase: SupabaseClient;
  creds: TwilioCreds;
  sendFn?: SendWhatsAppFn;
  /** When true, do not send WhatsApp — return planned messages instead. */
  dryRun?: boolean;
  emailFilter?: string;
}): Promise<CongresoCronResult> {
  const contentSid = process.env.TWILIO_CONGRESO_ONBOARDING_CONTENT_SID?.trim() ?? '';

  if (params.dryRun) {
    console.log('[congreso-onboarding] cron DRY_RUN');
    const planned = await planCongresoOnboarding({
      supabase: params.supabase,
      contentSid,
      emailFilter: params.emailFilter,
    });
    console.log(`[congreso-onboarding] dryRun planned ${planned.length} items`);
    for (const item of planned) {
      console.log(
        `[congreso-onboarding][dryRun] day=${item.day} email=${item.email} wouldSend=${item.wouldSend}${item.reason ? ` reason=${item.reason}` : ''}`,
      );
    }
    return {
      active_trials: new Set(planned.map((p) => p.trialId)).size,
      planned_count: planned.length,
      would_send: planned.filter((p) => p.wouldSend).length,
      planned,
    };
  }

  const sendFn =
    params.sendFn ??
    (async (args: Parameters<SendWhatsAppFn>[0]) => {
      const { sendWhatsApp } = await import('@/lib/twilio');
      await sendWhatsApp(args);
    });

  console.log('[congreso-onboarding] cron started');

  if (!contentSid) {
    console.warn(
      '[congreso-onboarding] TWILIO_CONGRESO_ONBOARDING_CONTENT_SID unset — skipping HSM sends',
    );
  }

  const appUrl = getKalyoAppUrl();
  let trials = await fetchActiveCongresoTrials(params.supabase);
  if (params.emailFilter) {
    const target = params.emailFilter.toLowerCase();
    trials = trials.filter((t) => t.email.toLowerCase() === target);
  }
  console.log(`[congreso-onboarding] found ${trials.length} active trials`);

  const summary: CongresoCronResult = {
    active_trials: trials.length,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  const now = new Date();

  for (const row of trials) {
    const elapsed = daysSinceActivation(row.activated_at, now);

    for (const entry of CONGRESO_ONBOARDING) {
      if (entry.day === 1) continue;

      const column = daySentColumn(entry.day);
      if (elapsed < entry.day) continue;
      if (row[column]) continue;

      if (!contentSid) {
        summary.skipped = (summary.skipped ?? 0) + 1;
        continue;
      }

      const result = await sendCongresoDay({
        supabase: params.supabase,
        row,
        day: entry.day,
        message: entry.message,
        creds: params.creds,
        sendFn,
        contentSid,
        appUrl,
      });

      summary[result] = ((summary[result] as number | undefined) ?? 0) + 1;

      if (result === 'sent') {
        (row as Record<string, unknown>)[column] = now.toISOString();
      }
    }
  }

  console.log('[congreso-onboarding] cron finished', summary);
  return summary;
}
