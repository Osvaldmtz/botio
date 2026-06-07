import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchBots,
  fetchConversations,
  fetchDashboardStats,
  type ConversationFilters,
  type ConversationStatusFilter,
  type DateRangeFilter,
} from '@/app/admin/conversations/lib/conversation-queries';

export const dynamic = 'force-dynamic';

function parseFilters(searchParams: URLSearchParams): ConversationFilters {
  const status = searchParams.get('status') as ConversationStatusFilter | null;
  const dateRange = searchParams.get('dateRange') as DateRangeFilter | null;

  return {
    botId: searchParams.get('botId') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    status: status && status !== 'all' ? status : 'all',
    dateRange: dateRange ?? 'all',
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
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
    const [conversations, stats, bots] = await Promise.all([
      fetchConversations(supabase, filters),
      fetchDashboardStats(supabase, filters.botId),
      fetchBots(supabase),
    ]);

    return NextResponse.json({
      conversations,
      stats,
      bots,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin/conversations] fetch failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
