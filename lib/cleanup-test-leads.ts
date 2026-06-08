import type { SupabaseClient } from '@supabase/supabase-js';

export async function cleanupStaleTestConversations(
  supabase: SupabaseClient,
  olderThanDays = 7,
): Promise<{ deleted: number; ids: string[] }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);
  const cutoffIso = cutoff.toISOString();

  const { data: rows, error } = await supabase
    .from('conversations')
    .select('id')
    .contains('metadata', { test: true })
    .lt('created_at', cutoffIso);

  if (error) throw error;

  const ids = (rows ?? []).map((r) => r.id as string);
  if (ids.length === 0) return { deleted: 0, ids: [] };

  await supabase.from('hot_lead_alert_queue').delete().in('conversation_id', ids);
  await supabase.from('detected_objections').delete().in('conversation_id', ids);
  await supabase.from('messages').delete().in('conversation_id', ids);

  const { error: deleteError } = await supabase.from('conversations').delete().in('id', ids);
  if (deleteError) throw deleteError;

  return { deleted: ids.length, ids };
}
