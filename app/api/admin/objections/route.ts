import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAmbassadorConversationIds } from '@/lib/ambassador-filters';

export const dynamic = 'force-dynamic';

type Filter =
  | 'all'
  | 'price'
  | 'thinking'
  | 'competition'
  | 'no_time'
  | 'not_useful'
  | 'few_patients';

const TYPE_LABELS: Record<string, string> = {
  price: 'Precio',
  thinking: 'Lo voy a pensar',
  competition: 'Competencia',
  no_time: 'Sin tiempo',
  not_useful: 'No me sirve',
  few_patients: 'Pocos pacientes',
};

export async function GET(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filter = (searchParams.get('filter') ?? 'all') as Filter;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createAdminClient();

  let query = supabase
    .from('detected_objections')
    .select('*')
    .order('detected_at', { ascending: false })
    .limit(300);

  if (filter !== 'all') {
    query = query.eq('objection_type', filter);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ambassadorIds = await fetchAmbassadorConversationIds(supabase);
  const salesRows = (data ?? []).filter(
    (row) => !row.conversation_id || !ambassadorIds.has(row.conversation_id as string),
  );

  const rows = salesRows.map((row) => ({
    ...row,
    type_label: TYPE_LABELS[row.objection_type as string] ?? row.objection_type,
  }));

  const { data: recent } = await supabase
    .from('detected_objections')
    .select('objection_type, outcome, conversation_id')
    .gte('detected_at', thirtyDaysAgo);

  const metricsBase = (recent ?? []).filter(
    (row) => !row.conversation_id || !ambassadorIds.has(row.conversation_id as string),
  );
  const total30d = metricsBase.length;
  const converted = metricsBase.filter((r) => r.outcome === 'converted').length;
  const conversionRate = total30d > 0 ? Math.round((converted / total30d) * 100) : 0;

  const typeCounts = new Map<string, number>();
  for (const row of metricsBase) {
    const t = row.objection_type as string;
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }

  const top3 = Array.from(typeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, count]) => ({
      type,
      label: TYPE_LABELS[type] ?? type,
      count,
    }));

  const conversionByType: Record<string, number> = {};
  for (const type of Object.keys(TYPE_LABELS)) {
    const subset = metricsBase.filter((r) => r.objection_type === type);
    const conv = subset.filter((r) => r.outcome === 'converted').length;
    conversionByType[type] =
      subset.length > 0 ? Math.round((conv / subset.length) * 100) : 0;
  }

  return NextResponse.json({
    rows,
    filter,
    metrics: {
      total_30d: total30d,
      conversion_rate_30d: conversionRate,
      top_3: top3,
      conversion_by_type: conversionByType,
    },
    fetchedAt: new Date().toISOString(),
  });
}
