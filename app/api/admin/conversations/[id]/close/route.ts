import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  closeConversationWithReason,
  isClosureReason,
} from '@/lib/conversation-closure';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

type CloseBody = {
  reason: string;
  note?: string;
};

export async function POST(request: Request, { params }: Params) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: CloseBody;
  try {
    body = (await request.json()) as CloseBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isClosureReason(body.reason)) {
    return NextResponse.json({ error: 'Invalid closure reason' }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    const conversation = await closeConversationWithReason(supabase, params.id, {
      reason: body.reason,
      note: body.note,
    });
    return NextResponse.json({ success: true, conversation });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[admin/close] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
