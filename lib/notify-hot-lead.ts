import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EnrichedLead, ConversationMessage } from '@/lib/lead-enrichment';
import { notifyHotLeadIfNew } from '@/lib/hot-lead-notifier';

/** @deprecated Use notifyHotLeadIfNew from lib/hot-lead-notifier */
export async function notifyHotLeadInstant(
  supabase: SupabaseClient,
  conversation: {
    id: string;
    customer_phone: string;
    lead_signals: string[] | null;
  },
  enrichment: EnrichedLead,
  messages: ConversationMessage[],
  name?: string,
): Promise<void> {
  await notifyHotLeadIfNew({
    supabase,
    conversation,
    enrichment,
    previousScore: 0,
    messages,
    name,
  });
}
