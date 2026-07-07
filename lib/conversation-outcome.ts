import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SALES_CONVERSATIONS_OR, TEAM_MEMBERS_FILTER } from '@/lib/ambassador-filters';
import { incrementTrialTrackingFailureCount } from '@/lib/trial-tracking-metrics';
import { alertTrialTrackingFailure } from '@/lib/trial-outcome-alert';
import { emailToWebOnlyPhone } from '@/lib/web-only-phone';
import {
  CONVERSATION_OUTCOMES,
  type ConversationOutcome,
  type OutcomeSource,
  isConversationOutcome,
  outcomeLabel,
} from '@/lib/conversation-outcome-labels';

export {
  CONVERSATION_OUTCOMES,
  type ConversationOutcome,
  type OutcomeSource,
  isConversationOutcome,
  outcomeLabel,
};

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

async function findConversationIdsFromTrialOnboarding(
  supabase: SupabaseClient,
  email: string,
): Promise<string[]> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];

  const { data, error } = await supabase
    .from('trial_onboarding_messages')
    .select('conversation_id')
    .eq('trial_user_email', normalized)
    .not('conversation_id', 'is', null);

  if (error) {
    console.error('[conversation-outcome] trial onboarding lookup failed', error);
    return [];
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => row.conversation_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  );
}

export async function findConversationIdsForContact(
  supabase: SupabaseClient,
  params: { email?: string; phone?: string },
): Promise<string[]> {
  const ids = new Set<string>();

  if (params.email) {
    for (const id of await findConversationIdsByEmail(supabase, params.email)) {
      ids.add(id);
    }
    for (const id of await findConversationIdsFromTrialOnboarding(supabase, params.email)) {
      ids.add(id);
    }
  }

  if (params.phone) {
    for (const id of await findConversationIdsByPhone(supabase, params.phone)) {
      ids.add(id);
    }
  }

  return Array.from(ids);
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
    ids = await findConversationIdsForContact(supabase, {
      email: input.email,
      phone: input.phone,
    });
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

const DEFAULT_KALYO_BOT_ID = '64f6eed2-1522-48fe-a2c6-f858b767df06';

async function ensureConversationForPaid(
  supabase: SupabaseClient,
  email: string,
  name?: string | null,
): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const existing = await findConversationIdsForContact(supabase, { email: normalized });
  if (existing.length > 0) return existing[0];

  const botId = process.env.KALYO_BOT_ID ?? DEFAULT_KALYO_BOT_ID;
  const phone = emailToWebOnlyPhone(normalized);
  const displayName = name?.trim() || normalized.split('@')[0];

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      bot_id: botId,
      customer_phone: phone,
      channel: 'web',
      lead_score: 50,
      lead_captured: true,
      metadata: {
        source: 'kalyo_web',
        customer_email: normalized,
        customer_name: displayName,
        web_only: true,
      },
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('bot_id', botId)
      .eq('customer_phone', phone)
      .maybeSingle();

    if (existingConv?.id) return existingConv.id as string;
    throw error;
  }

  console.log(
    `[conversation-outcome] created web-only conversation | email=${normalized} | conv=${data.id}`,
  );
  return data.id as string;
}

export type ProcessCustomerPaidResult = {
  outcome_updated: number;
  onboarding_updated: number;
  conversation_created: boolean;
};

/** Marks trial onboarding + conversation outcome paid; creates web-only conv if needed. */
export async function processCustomerPaid(
  supabase: SupabaseClient,
  email: string,
  source: OutcomeSource = 'stripe_webhook',
  options?: { name?: string | null },
): Promise<ProcessCustomerPaidResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    return { outcome_updated: 0, onboarding_updated: 0, conversation_created: false };
  }

  const { markTrialUpgradedToPaid } = await import('@/lib/trial-onboarding-enrollment');
  const onboardingUpdated = await markTrialUpgradedToPaid(supabase, normalized);

  const hadConversation =
    (await findConversationIdsForContact(supabase, { email: normalized })).length > 0;

  if (!hadConversation) {
    await ensureConversationForPaid(supabase, normalized, options?.name);
  }

  const outcomeUpdated = await markPaidByEmail(supabase, normalized, source);

  return {
    outcome_updated: outcomeUpdated,
    onboarding_updated: onboardingUpdated,
    conversation_created: !hadConversation,
  };
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

    const message = `outcome not updated | email=${email || '—'} | phone=${phone || '—'} | conv=${params.conversationId ?? '—'}`;
    console.error(`[trial-tracking] markTrialActivatedByContact failed | ${message}`);
    incrementTrialTrackingFailureCount();
    await alertTrialTrackingFailure(
      `${email || phone || params.conversationId} — outcome not updated`,
    );
    return false;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[trial-tracking] markTrialActivatedByContact failed', error);
    incrementTrialTrackingFailureCount();
    await alertTrialTrackingFailure(`${email || phone || 'unknown'} — ${errMsg}`);
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
