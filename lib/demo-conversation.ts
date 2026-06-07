import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarSlot } from '@/lib/google-calendar';
import type { CustomerTimezone, CustomerTimezoneLabel } from '@/lib/timezone-from-phone';

export type PendingDemoSlots = {
  slots: CalendarSlot[];
  custom?: CalendarSlot;
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  display_timezone: CustomerTimezone;
  display_label: CustomerTimezoneLabel;
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

export async function savePendingCustomSlot(
  supabase: SupabaseClient,
  conversationId: string,
  custom: CalendarSlot,
): Promise<void> {
  const pending = await loadPendingDemoSlots(supabase, conversationId);
  if (!pending) {
    throw new Error('No pending demo slots to attach custom slot');
  }
  await savePendingDemoSlots(supabase, conversationId, {
    ...pending,
    custom,
  });
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
