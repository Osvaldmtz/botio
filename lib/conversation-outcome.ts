import type { SupabaseClient } from '@supabase/supabase-js';
import { SALES_CONVERSATIONS_OR, TEAM_MEMBERS_FILTER } from '@/lib/ambassador-filters';
import { incrementTrialTrackingFailureCount } from '@/lib/trial-tracking-metrics';

export const CONVERSATION_OUTCOMES = [
  'paid',
  'trial_activated',
  'lost_no_response',
  'lost_objection',
  'lost_competitor',
  'lost_price',
  'unsubscribed',
] as const;

export type ConversationOutcome = (typeof CONVERSATION_OUTCOMES)[number];

export type OutcomeSource =
  | 'stripe_webhook'
  | 'trial_enroll'
  | 'cron_30days'
  | 'admin_manual'
  | string;

const OUTCOME_LABELS: Record<ConversationOutcome, string> = {
  paid: 'Pagó suscripción',
  trial_activated: 'Trial activado',
  lost_no_response: 'Sin respuesta (30d)',
  lost_objection: 'Objeción no superada',
  lost_competitor: 'Eligió competencia',
  lost_price: 'Precio barrera',
  unsubscribed: 'Pidió no contacto',
};

export function isConversationOutcome(value: string): value is ConversationOutcome {
  return (CONVERSATION_OUTCOMES as readonly string[]).includes(value);
}

export function outcomeLabel(outcome: string | null | undefined): string {
  if (!outcome) return 'Sin marcar';
  if (isConversationOutcome(outcome)) return OUTCOME_LABELS[outcome];
  return outcome;
}

function canAutoUpdateOutcome(
  current: string | null | undefined,
  next: ConversationOutcome,
): boolean {
  if (!current) return true;
  if (next === 'paid') return current !== 'unsubscribed';
  if (next === 'trial_activated') return false;
  if (next.startsWith('lost_')) return false;
  return false;
}

export async function findConversationIdsByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<string[]> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];

  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .or(`metadata->>customer_email.eq.${normalized},metadata->>email.eq.${normalized}`);

  if (error) {
    console.error('[conversation-outcome] email lookup failed', error);
    return [];
  }

  return (data ?? []).map((row) => row.id as string);
}

export async function findConversationIdsByPhone(
  supabase: SupabaseClient,
  phone: string,
): Promise<string[]> {
  const normalized = phone.trim();
  if (!normalized) return [];

  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_phone', normalized);

  if (error) {
    console.error('[conversation-outcome] phone lookup failed', error);
    return [];
  }

  return (data ?? []).map((row) => row.id as string);
}

export type SetConversationOutcomeInput = {
  conversationId?: string;
  email?: string;
  phone?: string;
  outcome: ConversationOutcome;
  source: OutcomeSource;
  notes?: string;
  force?: boolean;
};

export async function setConversationOutcome(
  supabase: SupabaseClient,
  input: SetConversationOutcomeInput,
): Promise<{ updated: number; conversation_ids: string[] }> {
  const now = new Date().toISOString();
  let ids: string[] = [];

  if (input.conversationId) {
    ids = [input.conversationId];
  } else {
    const byEmail = input.email ? await findConversationIdsByEmail(supabase, input.email) : [];
    const byPhone = input.phone ? await findConversationIdsByPhone(supabase, input.phone) : [];
    ids = Array.from(new Set([...byEmail, ...byPhone]));
  }

  if (ids.length === 0) {
    return { updated: 0, conversation_ids: [] };
  }

  let updated = 0;

  for (const id of ids) {
    const { data: row, error: fetchErr } = await supabase
      .from('conversations')
      .select('id, outcome, metadata')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !row) continue;

    if (!input.force && !canAutoUpdateOutcome(row.outcome as string | null, input.outcome)) {
      continue;
    }

    const metadata = {
      ...((row.metadata as Record<string, unknown> | null) ?? {}),
      ...(input.notes?.trim() ? { outcome_notes: input.notes.trim() } : {}),
    };

    const { error: updateErr } = await supabase
      .from('conversations')
      .update({
        outcome: input.outcome,
        outcome_date: now,
        outcome_source: input.source,
        metadata,
      })
      .eq('id', id);

    if (updateErr) {
      console.error('[conversation-outcome] update failed', { id, updateErr });
      continue;
    }

    updated += 1;
    console.log(
      `[conversation-outcome] marked | conv=${id} | outcome=${input.outcome} | source=${input.source}`,
    );
  }

  return { updated, conversation_ids: ids.slice(0, updated > 0 ? updated : ids.length) };
}

export async function markPaidByEmail(
  supabase: SupabaseClient,
  email: string,
  source: OutcomeSource = 'stripe_webhook',
): Promise<number> {
  const result = await setConversationOutcome(supabase, {
    email,
    outcome: 'paid',
    source,
  });
  return result.updated;
}

export async function markTrialActivatedByContact(
  supabase: SupabaseClient,
  params: { email?: string; phone?: string; conversationId?: string },
  source: OutcomeSource = 'trial_enroll',
): Promise<boolean> {
  const email = params.email?.trim().toLowerCase() ?? '';
  const phone = params.phone?.trim() ?? '';

  try {
    const result = await setConversationOutcome(supabase, {
      conversationId: params.conversationId,
      email: params.email,
      phone: params.phone,
      outcome: 'trial_activated',
      source,
    });

    if (result.updated > 0) {
      return true;
    }

    if (params.conversationId) {
      const { data: row } = await supabase
        .from('conversations')
        .select('outcome')
        .eq('id', params.conversationId)
        .maybeSingle();
      if (row?.outcome === 'trial_activated') {
        return true;
      }
    }

    const message = `Trial tracking: outcome not updated (updated=0) | email=${email || '—'} | phone=${phone || '—'} | conv=${params.conversationId ?? '—'}`;
    console.error(`[trial-tracking] markTrialActivatedByContact failed | ${message}`);
    incrementTrialTrackingFailureCount();
    const { sendTelegramAlert } = await import('@/lib/telegram');
    await sendTelegramAlert(`⚠️ Trial tracking failed: ${email || phone || params.conversationId} — outcome not updated`);
    return false;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[trial-tracking] markTrialActivatedByContact failed', error);
    incrementTrialTrackingFailureCount();
    const { sendTelegramAlert } = await import('@/lib/telegram');
    await sendTelegramAlert(`⚠️ Trial tracking failed: ${email || phone || 'unknown'} — ${errMsg}`);
    return false;
  }
}

export async function markLostNoResponseConversations(
  supabase: SupabaseClient,
): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .is('outcome', null)
    .lt('last_message_at', cutoff)
    .or(TEAM_MEMBERS_FILTER)
    .or(SALES_CONVERSATIONS_OR);

  if (error) {
    console.error('[conversation-outcome] lost cron query failed', error);
    throw error;
  }

  const ids = (data ?? []).map((row) => row.id as string);
  if (ids.length === 0) return 0;

  const { data: updatedRows, error: updateErr } = await supabase
    .from('conversations')
    .update({
      outcome: 'lost_no_response',
      outcome_date: now,
      outcome_source: 'cron_30days',
    })
    .in('id', ids)
    .is('outcome', null)
    .select('id');

  if (updateErr) {
    console.error('[conversation-outcome] lost cron batch update failed', updateErr);
    throw updateErr;
  }

  const updated = updatedRows?.length ?? 0;
  console.log(`[conversation-outcome] lost cron | updated=${updated}`);
  return updated;
}
