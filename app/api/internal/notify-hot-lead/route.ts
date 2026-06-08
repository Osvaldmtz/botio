import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyHotLeadFromConversation } from '@/lib/hot-lead-notifier';

export const dynamic = 'force-dynamic';

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let conversationId = '';
  let force = false;
  try {
    const body = (await request.json()) as { conversation_id?: string; force?: boolean };
    conversationId = typeof body.conversation_id === 'string' ? body.conversation_id.trim() : '';
    force = body.force === true;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!conversationId) {
    return NextResponse.json({ error: 'conversation_id required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const result = await notifyHotLeadFromConversation(supabase, conversationId, { force });
    return NextResponse.json({ success: result.sent, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[internal/notify-hot-lead] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
