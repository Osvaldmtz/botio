import type { SupabaseClient } from '@supabase/supabase-js';

/** PostgREST filter: sales leads only (excludes is_ambassador = true). */
export const SALES_CONVERSATIONS_OR = 'is_ambassador.is.null,is_ambassador.eq.false';

/** PostgREST filter: non-team members only (excludes is_team_member = true). */
export const TEAM_MEMBERS_FILTER = 'is_team_member.is.null,is_team_member.eq.false';

export type LeadTypeFilter = 'all' | 'sales' | 'ambassadors';

export function isSalesLead(isAmbassador: boolean | null | undefined): boolean {
  return isAmbassador !== true;
}

export async function fetchAmbassadorConversationIds(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('is_ambassador', true);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.id as string));
}

export function filterSummariesByLeadType<T extends { id: string }>(
  rows: T[],
  leadType: LeadTypeFilter,
  ambassadorIds: Set<string>,
): T[] {
  if (leadType === 'all') return rows;
  if (leadType === 'ambassadors') {
    return rows.filter((row) => ambassadorIds.has(row.id));
  }
  return rows.filter((row) => !ambassadorIds.has(row.id));
}
