import type { SupabaseClient } from '@supabase/supabase-js';
import { isWebOnlyPhone } from '@/lib/web-only-phone';
import { buildImmediateWelcomeMessage } from '@/lib/kalyo-trial-messages';
import type { TwilioCreds } from '@/lib/trial-onboarding-cron';

export type WelcomeRetryRow = {
  id: string;
  customer_phone: string;
  trial_user_email: string;
  trial_user_name: string | null;
  trial_ends_at: string;
  conversation_id: string | null;
  welcome_msg_status: string | null;
};

const RETRY_STATUS_OR =
  'welcome_msg_status.is.null,welcome_msg_status.eq.failed,welcome_msg_status.eq.pending';

/** Trials that never got day-1 welcome — eligible for cron retry. */
export async function fetchPendingWelcomeRetries(
  supabase: SupabaseClient,
  limit = 30,
): Promise<WelcomeRetryRow[]> {
  const graceStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('trial_onboarding_messages')
    .select(
      'id, customer_phone, trial_user_email, trial_user_name, trial_ends_at, conversation_id, welcome_msg_status',
    )
    .is('day_1_sent_at', null)
    .eq('unsubscribed', false)
    .is('upgraded_to_paid_at', null)
    .gte('trial_started_at', graceStart)
    .or(RETRY_STATUS_OR)
    .order('trial_started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as WelcomeRetryRow[]).filter(
    (row) => row.customer_phone && !isWebOnlyPhone(row.customer_phone),
  );
}

export async function retryWelcomeForRow(params: {
  supabase: SupabaseClient;
  row: WelcomeRetryRow;
  creds: TwilioCreds;
}): Promise<'sent' | 'failed' | 'skipped'> {
  const phone = params.row.customer_phone.trim();
  if (!phone || isWebOnlyPhone(phone)) return 'skipped';

  const name = params.row.trial_user_name?.trim() || params.row.trial_user_email.split('@')[0];

  const { sendWelcomeMessage } = await import('@/lib/trial-onboarding-webhook');
  const result = await sendWelcomeMessage({
    to: phone,
    name,
    creds: params.creds,
    email: params.row.trial_user_email,
    trialEndsAt: params.row.trial_ends_at,
    trialPlan: 'max',
  });

  const welcomeStatus = result.success ? 'sent' : 'failed';

  await params.supabase
    .from('trial_onboarding_messages')
    .update({
      welcome_msg_status: welcomeStatus,
      welcome_msg_method: result.method,
    })
    .eq('id', params.row.id);

  if (!result.success) {
    console.warn(
      `[trial-onboarding] welcome retry failed | id=${params.row.id} | reason=${result.reason ?? 'unknown'}`,
    );
    return 'failed';
  }

  if (params.row.conversation_id) {
    const welcomeBody = buildImmediateWelcomeMessage(name, {
      email: params.row.trial_user_email,
      trialPlan: 'max',
      trialEndsAt: params.row.trial_ends_at,
    });
    await params.supabase.from('messages').insert({
      conversation_id: params.row.conversation_id,
      role: 'assistant',
      content: welcomeBody,
      source: 'text',
      source_type: 'claude',
      metadata: {
        source: 'trial_onboarding_welcome',
        delivery_method: result.method,
        twilio_sid: result.sid ?? null,
        welcome_retry: true,
      },
    });
  }

  await params.supabase
    .from('trial_onboarding_messages')
    .update({ day_1_sent_at: new Date().toISOString() })
    .eq('id', params.row.id)
    .is('day_1_sent_at', null);

  console.log(
    `[trial-onboarding] welcome retry sent | id=${params.row.id} | email=${params.row.trial_user_email}`,
  );
  return 'sent';
}

export async function runWelcomeRetries(params: {
  supabase: SupabaseClient;
  creds: TwilioCreds;
}): Promise<{ pending: number; sent: number; failed: number; skipped: number }> {
  const rows = await fetchPendingWelcomeRetries(params.supabase);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const outcome = await retryWelcomeForRow({
      supabase: params.supabase,
      row,
      creds: params.creds,
    });
    if (outcome === 'sent') sent += 1;
    else if (outcome === 'failed') failed += 1;
    else skipped += 1;
  }

  return { pending: rows.length, sent, failed, skipped };
}
