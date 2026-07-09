import 'server-only';
import { format, subDays } from 'date-fns';
import { createAdminClient } from '@/lib/supabase/admin';
import type { KalyoMetricRow } from '@/lib/kpi/types';

export type SofiaSalesMetrics = {
  max_share_pct: number | null;
  plan_pro: number;
  plan_max: number;
  primer50_links_sent_30d: number;
  purchase_intent_max_30d: number;
  purchase_intent_pro_30d: number;
  max_vs_pro_intent_ratio: number | null;
  max_share_trend_7d: Array<{ date: string; max_pct: number }>;
};

export async function fetchSofiaSalesMetrics(
  kalyoLatest: KalyoMetricRow | null,
  kalyoHistory: KalyoMetricRow[],
): Promise<SofiaSalesMetrics> {
  const supabase = createAdminClient();
  const since30d = subDays(new Date(), 30).toISOString();
  const since7d = format(subDays(new Date(), 7), 'yyyy-MM-dd');

  const { data: primer50Messages } = await supabase
    .from('messages')
    .select('id')
    .eq('role', 'assistant')
    .gte('created_at', since30d)
    .ilike('content', '%PRIMER50%');

  const { data: intentMessages } = await supabase
    .from('messages')
    .select('metadata')
    .eq('role', 'assistant')
    .gte('created_at', since30d)
    .filter('metadata->>source', 'in', '("purchase_intent_max","purchase_intent_pro")');

  let purchase_intent_max_30d = 0;
  let purchase_intent_pro_30d = 0;
  for (const row of intentMessages ?? []) {
    const source = (row.metadata as { source?: string } | null)?.source;
    if (source === 'purchase_intent_max') purchase_intent_max_30d += 1;
    if (source === 'purchase_intent_pro') purchase_intent_pro_30d += 1;
  }

  const plan_pro = kalyoLatest?.plan_pro ?? 0;
  const plan_max = kalyoLatest?.plan_max ?? 0;
  const paidTotal = plan_pro + plan_max;
  const max_share_pct = paidTotal > 0 ? Number(((plan_max / paidTotal) * 100).toFixed(1)) : null;

  const intentTotal = purchase_intent_max_30d + purchase_intent_pro_30d;
  const max_vs_pro_intent_ratio =
    intentTotal > 0
      ? Number(((purchase_intent_max_30d / intentTotal) * 100).toFixed(1))
      : null;

  const max_share_trend_7d = kalyoHistory
    .filter((row) => row.date >= since7d)
    .map((row) => {
      const pro = row.plan_pro ?? 0;
      const max = row.plan_max ?? 0;
      const total = pro + max;
      return {
        date: row.date.slice(5),
        max_pct: total > 0 ? Number(((max / total) * 100).toFixed(1)) : 0,
      };
    });

  return {
    max_share_pct,
    plan_pro,
    plan_max,
    primer50_links_sent_30d: primer50Messages?.length ?? 0,
    purchase_intent_max_30d,
    purchase_intent_pro_30d,
    max_vs_pro_intent_ratio,
    max_share_trend_7d,
  };
}
