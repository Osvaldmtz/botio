import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enrichLead, type ConversationMessage } from '@/lib/lead-enrichment';
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

  const enriched = enrichLead({
    phone,
    conversationMessages: rows as ConversationMessage[],
  });

  const { error: updateError } = await supabase
    .from('conversations')
    .update({
      lead_score: enriched.score,
      lead_temperature: enriched.temperature,
      lead_country: enriched.country,
      lead_city: enriched.city ?? null,
      lead_intent: enriched.intent,
      lead_signals: enriched.signals,
      enriched_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (updateError) {
    console.error('[handoff] lead enrichment update failed', updateError);
  }
}
