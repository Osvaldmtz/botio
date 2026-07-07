import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
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
  const { error } = await supabase
    .from('hot_lead_alert_queue')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', rowId);

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

  return true;
}

export async function processHotLeadAlertQueue(
  supabase: SupabaseClient,
  limit = 20,
): Promise<{ processed: number; sent: number; skipped: number }> {
  const { data: rows, error } = await supabase
    .from('hot_lead_alert_queue')
    .select('id, conversation_id, lead_score')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;

  let sent = 0;
  let skipped = 0;

  for (const row of (rows ?? []) as QueueRow[]) {
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('lead_signals')
      .eq('id', row.conversation_id)
      .maybeSingle();

    if (convError) throw convError;

    const signals = normalizeLeadSignals(conv?.lead_signals);
    if (!shouldSendHotAlert(signals)) {
      console.log(
        `[hot-lead-alert-cron] skip — already alerted in 24h | conv=${row.conversation_id}`,
      );
      await markQueueProcessed(supabase, row.id, row.conversation_id);
      skipped += 1;
      continue;
    }

    const result = await notifyHotLeadFromConversation(supabase, row.conversation_id);
    await markQueueProcessed(supabase, row.id, row.conversation_id);
    if (result.sent) sent += 1;
  }

  return { processed: rows?.length ?? 0, sent, skipped };
}
