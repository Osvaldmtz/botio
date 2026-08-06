import 'server-only';
import { subDays } from 'date-fns';
import { getKalyoClient } from '@/lib/kalyo-supabase';
import { aggregateTrialsByChannel } from '@/lib/trial-acquisition-utils';
import type {
  TrialAcquisitionDays,
  TrialAcquisitionResponse,
} from '@/lib/trial-acquisition-types';

type PsychologistAttributionRow = {
  attribution: unknown;
  created_at: string;
};

const PAGE_SIZE = 1000;

async function fetchTrialPsychologists(sinceIso: string): Promise<PsychologistAttributionRow[]> {
  const kalyo = getKalyoClient();
  const all: PsychologistAttributionRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await kalyo
      .from('psychologists')
      .select('attribution, created_at')
      .not('trial_ends_at', 'is', null)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`psychologists trial acquisition: ${error.message}`);
    }

    const batch = (data ?? []) as PsychologistAttributionRow[];
    all.push(...batch);

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

export async function fetchTrialAcquisitionBreakdown(
  days: TrialAcquisitionDays,
): Promise<TrialAcquisitionResponse> {
  const sinceIso = subDays(new Date(), days).toISOString();
  const rows = await fetchTrialPsychologists(sinceIso);
  const aggregated = aggregateTrialsByChannel(rows);

  return {
    days,
    total_trials: rows.length,
    rows: aggregated,
    fetched_at: new Date().toISOString(),
  };
}
