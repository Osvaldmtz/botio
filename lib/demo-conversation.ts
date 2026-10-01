import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarSlot } from '@/lib/google-calendar';
import { isPendingDemoSlotsExpired } from '@/lib/demo-flow-parsing';

export type PendingDemoSlots = {
  slots: CalendarSlot[];
  custom?: CalendarSlot;
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  customer_city?: string;
  customer_timezone: string;
  customer_city_label: string;
  display_timezone: string;
  display_label: string;
  offered_at: string;
  /** Ignore the offer once the original demo hour has passed. */
  expires_at?: string;
};

export type PendingDemoCancellation = {
  demo_id: string;
  asked_at: string;
};

export type PendingBookedConfirm = {
  demo_id: string;
  slot_label: string;
  asked_at: string;
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
  const slots = pending as PendingDemoSlots;
  if (isPendingDemoSlotsExpired(slots)) return null;
  return slots;
}

async function patchConversationMetadata(
  supabase: SupabaseClient,
  conversationId: string,
  mutate: (metadata: Record<string, unknown>) => void,
): Promise<void> {
  const { data: row, error: fetchError } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);

  const metadata = { ...((row?.metadata as Record<string, unknown> | null) ?? {}) };
  mutate(metadata);

  const { error } = await supabase
    .from('conversations')
    .update({ metadata })
    .eq('id', conversationId);

  if (error) throw new Error(error.message);
}

export async function loadPendingDemoCancellation(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<PendingDemoCancellation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const metadata = (data?.metadata as Record<string, unknown> | null) ?? {};
  const pending = metadata.pending_demo_cancellation;
  if (!pending || typeof pending !== 'object') return null;
  const row = pending as PendingDemoCancellation;
  if (!row.demo_id) return null;
  return row;
}

export async function savePendingDemoCancellation(
  supabase: SupabaseClient,
  conversationId: string,
  pending: PendingDemoCancellation,
): Promise<void> {
  await patchConversationMetadata(supabase, conversationId, (metadata) => {
    metadata.pending_demo_cancellation = pending;
  });
}

export async function clearPendingDemoCancellation(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<void> {
  await patchConversationMetadata(supabase, conversationId, (metadata) => {
    delete metadata.pending_demo_cancellation;
  });
}

export async function loadPendingBookedConfirm(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<PendingBookedConfirm | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const metadata = (data?.metadata as Record<string, unknown> | null) ?? {};
  const pending = metadata.pending_booked_confirm;
  if (!pending || typeof pending !== 'object') return null;
  const row = pending as PendingBookedConfirm;
  if (!row.demo_id) return null;
  return row;
}

export async function savePendingBookedConfirm(
  supabase: SupabaseClient,
  conversationId: string,
  pending: PendingBookedConfirm,
): Promise<void> {
  await patchConversationMetadata(supabase, conversationId, (metadata) => {
    metadata.pending_booked_confirm = pending;
  });
}

export async function clearPendingBookedConfirm(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<void> {
  await patchConversationMetadata(supabase, conversationId, (metadata) => {
    delete metadata.pending_booked_confirm;
  });
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
