import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enrichAndNotifyLead, type ConversationMessage } from '@/lib/lead-enrichment';
import { isKalyoBotId } from '@/lib/conversation-utils';

export async function maybeEnrichConversationOnHandoff(
  supabase: SupabaseClient,
  botId: string,
  conversationId: string,
  phone: string,
): Promise<void> {
  if (!isKalyoBotId(botId)) return;

  const { data: rows, error } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error || !rows?.length) return;

  await enrichAndNotifyLead(supabase, {
    conversationId,
    phone,
    conversationMessages: rows as ConversationMessage[],
  });
}
