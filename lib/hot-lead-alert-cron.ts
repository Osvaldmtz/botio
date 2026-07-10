import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isStaleHotLead,
  notifyHotLeadFromConversation,
  normalizeLeadSignals,
  shouldSendHotAlert,
} from '@/lib/hot-lead-notifier';
import { sendTelegramAlert } from '@/lib/telegram';

type QueueRow = {
  id: string;
  conversation_id: string;
  lead_score: number;
};

async function markQueueProcessed(
  supabase: SupabaseClient,
  rowId: string,
  conversationId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('hot_lead_alert_queue')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', rowId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error(
      `[hot-lead-alert-cron] processed_at update failed | queue=${rowId} conv=${conversationId}`,
      error,
    );
    await sendTelegramAlert(
      `⚠️ hot_lead_alert_queue: failed to mark processed | conv=${conversationId} | ${error.message}`,
    );
    return false;
  }

  if (!data) {
    console.error(
      `[hot-lead-alert-cron] processed_at update matched 0 rows | queue=${rowId} conv=${conversationId}`,
    );
    return false;
  }

  return true;
}

export async function processHotLeadAlertQueue(
  supabase: SupabaseClient,
  limit = 20,
): Promise<{ processed: number; sent: number; skipped: number; stale: number }> {
  const { data: rows, error } = await supabase
    .from('hot_lead_alert_queue')
    .select('id, conversation_id, lead_score')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;

  let sent = 0;
  let skipped = 0;
  let stale = 0;

  for (const row of (rows ?? []) as QueueRow[]) {
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('lead_signals, hot_alert_sent_at, last_message_at, enriched_at')
      .eq('id', row.conversation_id)
      .maybeSingle();

    if (convError) throw convError;

    const signals = normalizeLeadSignals(conv?.lead_signals);
    const hotAlertSentAt = (conv?.hot_alert_sent_at as string | null | undefined) ?? null;
    if (!shouldSendHotAlert(signals, hotAlertSentAt)) {
      console.log(
        `[hot-lead-alert-cron] skip — already alerted in 24h | conv=${row.conversation_id}`,
      );
      await markQueueProcessed(supabase, row.id, row.conversation_id);
      skipped += 1;
      continue;
    }

    if (
      isStaleHotLead(
        conv?.last_message_at as string | null | undefined,
        conv?.enriched_at as string | null | undefined,
      )
    ) {
      console.log(
        `[hot-lead-alert-cron] skip — stale lead (>2h sin actividad) | conv=${row.conversation_id}`,
      );
      await markQueueProcessed(supabase, row.id, row.conversation_id);
      stale += 1;
      continue;
    }

    const result = await notifyHotLeadFromConversation(supabase, row.conversation_id);
    const marked = await markQueueProcessed(supabase, row.id, row.conversation_id);
    if (!marked) {
      console.error(
        `[hot-lead-alert-cron] queue row still pending after send | conv=${row.conversation_id}`,
      );
    }
    if (result.sent) sent += 1;
    else if (result.reason === 'already_sent' || result.reason === 'stale_lead') skipped += 1;
  }

  return { processed: rows?.length ?? 0, sent, skipped, stale };
}
