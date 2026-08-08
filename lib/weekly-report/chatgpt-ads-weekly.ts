import 'server-only';
import { formatUnknownError } from '@/lib/format-error';
import { getKalyoClient } from '@/lib/kalyo-supabase';
import type { ChatGPTAdsWeeklyReport } from '@/lib/weekly-report/types';
import {
  getPreviousWeeklyDateRange,
  getWeeklyDateRange,
} from '@/lib/weekly-report/wow-utils';

const UTM_SOURCE = 'chatgpt';

function rangeToIsoBounds(range: { startDate: string; endDate: string }): {
  startIso: string;
  endIsoExclusive: string;
} {
  const startIso = `${range.startDate}T00:00:00.000Z`;
  const end = new Date(`${range.endDate}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { startIso, endIsoExclusive: end.toISOString() };
}

async function countChatgptRegistrations(
  startIso: string,
  endIsoExclusive: string,
): Promise<number> {
  const kalyo = getKalyoClient();
  const { count, error } = await kalyo
    .from('psychologists')
    .select('id', { count: 'exact', head: true })
    .filter('attribution->>utm_source', 'ilike', UTM_SOURCE)
    .gte('created_at', startIso)
    .lt('created_at', endIsoExclusive);

  if (error) throw new Error(`chatgpt ads registrations: ${error.message}`);
  return count ?? 0;
}

async function countChatgptActivations(
  startIso: string,
  endIsoExclusive: string,
): Promise<number> {
  const kalyo = getKalyoClient();
  const { count, error } = await kalyo
    .from('psychologists')
    .select('id', { count: 'exact', head: true })
    .filter('attribution->>utm_source', 'ilike', UTM_SOURCE)
    .gte('subscription_activated_at', startIso)
    .lt('subscription_activated_at', endIsoExclusive);

  if (error) throw new Error(`chatgpt ads activations: ${error.message}`);
  return count ?? 0;
}

/** Weekly ChatGPT Ads conversions from psychologists.attribution (no OpenAI Ads API). */
export async function getChatGPTAdsStats(): Promise<ChatGPTAdsWeeklyReport> {
  const range = getWeeklyDateRange();
  const previous_range = getPreviousWeeklyDateRange();
  const currentBounds = rangeToIsoBounds(range);
  const previousBounds = rangeToIsoBounds(previous_range);

  try {
    const [registrations, activations, prevRegistrations, prevActivations] =
      await Promise.all([
        countChatgptRegistrations(currentBounds.startIso, currentBounds.endIsoExclusive),
        countChatgptActivations(currentBounds.startIso, currentBounds.endIsoExclusive),
        countChatgptRegistrations(previousBounds.startIso, previousBounds.endIsoExclusive),
        countChatgptActivations(previousBounds.startIso, previousBounds.endIsoExclusive),
      ]);

    return {
      period: 'last_7d',
      range,
      previous_range,
      registrations,
      activations,
      previous_registrations: prevRegistrations,
      previous_activations: prevActivations,
      updated_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      period: 'last_7d',
      range,
      previous_range,
      registrations: 0,
      activations: 0,
      previous_registrations: 0,
      previous_activations: 0,
      updated_at: new Date().toISOString(),
      error: formatUnknownError(error),
    };
  }
}
