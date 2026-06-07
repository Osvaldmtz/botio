import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchConversationDetail } from '@/app/admin/conversations/lib/conversation-queries';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(_request: Request, { params }: Params) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const detail = await fetchConversationDetail(supabase, params.id);
    if (!detail) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ conversation: detail, fetchedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin/conversations/detail] fetch failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
