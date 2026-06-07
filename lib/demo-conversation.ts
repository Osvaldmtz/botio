import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarSlot } from '@/lib/google-calendar';

export type PendingDemoSlots = {
  slots: CalendarSlot[];
  customer_email: string;
  customer_name: string;
  offered_at: string;
};

export async function savePendingDemoSlots(
  supabase: SupabaseClient,
  conversationId: string,
  pending: PendingDemoSlots,
): Promise<void> {
  const { data: row, error: fetchError } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);

  const metadata = (row?.metadata as Record<string, unknown> | null) ?? {};
  metadata.pending_demo_slots = pending;

  const { error } = await supabase
    .from('conversations')
    .update({ metadata })
    .eq('id', conversationId);

  if (error) throw new Error(error.message);
}

export async function loadPendingDemoSlots(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<PendingDemoSlots | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const metadata = (data?.metadata as Record<string, unknown> | null) ?? {};
  const pending = metadata.pending_demo_slots;
  if (!pending || typeof pending !== 'object') return null;
  return pending as PendingDemoSlots;
}

export async function clearPendingDemoSlots(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<void> {
  const { data: row, error: fetchError } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);

  const metadata = { ...((row?.metadata as Record<string, unknown> | null) ?? {}) };
  delete metadata.pending_demo_slots;

  const { error } = await supabase
    .from('conversations')
    .update({ metadata })
    .eq('id', conversationId);

  if (error) throw new Error(error.message);
}
