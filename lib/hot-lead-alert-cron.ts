import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyHotLeadFromConversation } from '@/lib/hot-lead-notifier';

type QueueRow = {
  id: string;
  conversation_id: string;
  lead_score: number;
};

export async function processHotLeadAlertQueue(
  supabase: SupabaseClient,
  limit = 20,
): Promise<{ processed: number; sent: number }> {
  const { data: rows, error } = await supabase
    .from('hot_lead_alert_queue')
    .select('id, conversation_id, lead_score')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;

  let sent = 0;
  for (const row of (rows ?? []) as QueueRow[]) {
    const result = await notifyHotLeadFromConversation(supabase, row.conversation_id);
    await supabase
      .from('hot_lead_alert_queue')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', row.id);
    if (result.sent) sent += 1;
  }

  return { processed: rows?.length ?? 0, sent };
}
