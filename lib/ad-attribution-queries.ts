import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bucketAdChannel, type AdChannelBucket } from '@/lib/ad-attribution';
import { SALES_CONVERSATIONS_OR, TEAM_MEMBERS_FILTER } from '@/lib/ambassador-filters';
import {
  ATTRIBUTION_MRR_USD,
  CHANNEL_LABELS,
  type ChannelAttributionResponse,
  type ChannelAttributionRow,
} from '@/lib/ads-attribution-types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const CHANNEL_ORDER: AdChannelBucket[] = ['meta', 'google', 'web', 'organic'];

function emptyBuckets(): Record<AdChannelBucket, { leads: number; trials: number; paid: number }> {
  return {
    meta: { leads: 0, trials: 0, paid: 0 },
    google: { leads: 0, trials: 0, paid: 0 },
    web: { leads: 0, trials: 0, paid: 0 },
    organic: { leads: 0, trials: 0, paid: 0 },
  };
}

function sinceIso(): string {
  return new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
}

export async function fetchChannelAttribution(
  supabase: SupabaseClient,
  spendByChannel?: { meta_usd?: number; google_usd?: number },
): Promise<ChannelAttributionResponse> {
  const since = sinceIso();
  const buckets = emptyBuckets();

  const [convRes, trialRes, paidRes, ambassadorIdsRes] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, metadata, outcome')
      .gte('created_at', since)
      .or(SALES_CONVERSATIONS_OR)
      .or(TEAM_MEMBERS_FILTER),
    supabase
      .from('conversations')
      .select('id, metadata')
      .eq('outcome', 'trial_activated')
      .gte('outcome_date', since)
      .or(SALES_CONVERSATIONS_OR)
      .or(TEAM_MEMBERS_FILTER),
    supabase
      .from('conversations')
      .select('id, metadata')
      .eq('outcome', 'paid')
      .gte('outcome_date', since)
      .or(SALES_CONVERSATIONS_OR)
      .or(TEAM_MEMBERS_FILTER),
    supabase.from('conversations').select('id').eq('is_ambassador', true),
  ]);

  if (convRes.error) throw new Error(convRes.error.message);
  if (trialRes.error) throw new Error(trialRes.error.message);
  if (paidRes.error) throw new Error(paidRes.error.message);
  if (ambassadorIdsRes.error) throw new Error(ambassadorIdsRes.error.message);

  const ambassadorIds = new Set(
    (ambassadorIdsRes.data ?? []).map((row) => row.id as string),
  );

  for (const row of convRes.data ?? []) {
    if (ambassadorIds.has(row.id as string)) continue;
    const channel = bucketAdChannel(row.metadata as Record<string, unknown> | null);
    buckets[channel].leads += 1;
  }

  for (const row of trialRes.data ?? []) {
    if (ambassadorIds.has(row.id as string)) continue;
    const channel = bucketAdChannel(row.metadata as Record<string, unknown> | null);
    buckets[channel].trials += 1;
  }

  for (const row of paidRes.data ?? []) {
    if (ambassadorIds.has(row.id as string)) continue;
    const channel = bucketAdChannel(row.metadata as Record<string, unknown> | null);
    buckets[channel].paid += 1;
  }

  const metaSpend = spendByChannel?.meta_usd ?? null;
  const googleSpend = spendByChannel?.google_usd ?? null;

  const rows: ChannelAttributionRow[] = CHANNEL_ORDER.map((channel) => {
    const counts = buckets[channel];
    const spendUsd =
      channel === 'meta' ? metaSpend : channel === 'google' ? googleSpend : null;
    const cacUsd =
      spendUsd != null && counts.paid > 0 ? spendUsd / counts.paid : null;
    const roas =
      spendUsd != null && spendUsd > 0 && counts.paid > 0
        ? (counts.paid * ATTRIBUTION_MRR_USD) / spendUsd
        : null;

    return {
      channel,
      label: CHANNEL_LABELS[channel],
      leads: counts.leads,
      trials: counts.trials,
      paid: counts.paid,
      spend_usd: spendUsd,
      cac_usd: cacUsd,
      roas,
    };
  });

  const hasAdAttribution = rows.some(
    (r) => (r.channel === 'meta' || r.channel === 'google') && r.leads > 0,
  );

  return {
    updated_at: new Date().toISOString(),
    period: 'last_30d',
    rows,
    note: hasAdAttribution
      ? undefined
      : 'Sin leads atribuidos a ads aún. Los datos aparecerán cuando entren conversaciones con metadata de Meta o Google.',
  };
}
