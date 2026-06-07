import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchBots } from '@/app/admin/conversations/lib/conversation-queries';
import {
  fetchPipelineLeads,
  fetchPipelineStats,
  type PipelineFilters,
} from '@/app/admin/conversations/lib/pipeline-queries';
import { PIPELINE_STAGES, normalizeStage } from '@/lib/pipeline-utils';

export const dynamic = 'force-dynamic';

function parseFilters(params: URLSearchParams): PipelineFilters {
  const temp = params.get('temperature');
  const dateRange = params.get('dateRange');

  return {
    botId: params.get('botId') ?? undefined,
    temperature:
      temp === 'hot' || temp === 'warm' || temp === 'cold' ? temp : undefined,
    dateRange:
      dateRange === '7d' || dateRange === '30d' || dateRange === 'custom'
        ? dateRange
        : 'all',
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  };
}

export async function GET(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filters = parseFilters(searchParams);
  const supabase = createAdminClient();

  try {
    const [leads, stats, bots] = await Promise.all([
      fetchPipelineLeads(supabase, filters),
      fetchPipelineStats(supabase, filters.botId),
      fetchBots(supabase),
    ]);

    const grouped = Object.fromEntries(
      PIPELINE_STAGES.map((stage) => [stage, [] as typeof leads]),
    ) as Record<(typeof PIPELINE_STAGES)[number], typeof leads>;

    for (const lead of leads) {
      const stage = normalizeStage(lead.pipeline_stage);
      grouped[stage].push(lead);
    }

    return NextResponse.json({
      grouped,
      stats,
      bots,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin/pipeline] fetch failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
