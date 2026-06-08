import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { reopenConversation } from '@/lib/conversation-closure';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function POST(_request: Request, { params }: Params) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const conversation = await reopenConversation(supabase, params.id);
    return NextResponse.json({ success: true, conversation });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin/reopen] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
