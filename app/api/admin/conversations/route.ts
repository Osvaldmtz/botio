import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchBots,
  fetchConversations,
  fetchDashboardStats,
  fetchNewHotLeads,
  type ClosureFilter,
  type ConversationFilters,
  type ConversationStatusFilter,
  type DateRangeFilter,
} from '@/app/admin/conversations/lib/conversation-queries';
import { isClosureReason } from '@/lib/conversation-closure';

export const dynamic = 'force-dynamic';

function parseFilters(searchParams: URLSearchParams): ConversationFilters {
  const status = searchParams.get('status') as ConversationStatusFilter | null;
  const dateRange = searchParams.get('dateRange') as DateRangeFilter | null;

  const channel = searchParams.get('channel');
  const validChannel =
    channel === 'whatsapp' || channel === 'webchat' || channel === 'telegram'
      ? channel
      : 'all';

  const closureParam = searchParams.get('closure');
  let closure: ClosureFilter = 'all';
  if (closureParam === 'active' || closureParam === 'closed') {
    closure = closureParam;
  } else if (closureParam && isClosureReason(closureParam)) {
    closure = closureParam;
  }

  return {
    botId: searchParams.get('botId') ?? undefined,
    channel: validChannel,
    search: searchParams.get('search') ?? undefined,
    status: status && status !== 'all' ? status : 'all',
    closure,
    hotUnattended: searchParams.get('hotUnattended') === 'true',
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
  const supabase = createAdminClient();

  if (searchParams.get('onlyHot') === 'true') {
    const newSince = searchParams.get('newSince');
    if (!newSince) {
      return NextResponse.json({ error: 'newSince is required' }, { status: 400 });
    }
    try {
      const conversations = await fetchNewHotLeads(supabase, newSince);
      return NextResponse.json({
        conversations,
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[admin/conversations] hot leads fetch failed', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const filters = parseFilters(searchParams);

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
