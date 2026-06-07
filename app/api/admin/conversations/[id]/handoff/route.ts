import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

type HandoffBody = {
  action: 'take' | 'release';
  taken_by?: string;
};

export async function POST(request: Request, { params }: Params) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: HandoffBody;
  try {
    body = (await request.json()) as HandoffBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.action !== 'take' && body.action !== 'release') {
    return NextResponse.json({ error: 'action must be take or release' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const conversationId = params.id;

  if (body.action === 'take') {
    const takenBy = body.taken_by?.trim() || 'Admin';
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('conversations')
      .update({
        handoff_active: true,
        handoff_taken_by: takenBy,
        handoff_started_at: now,
      })
      .eq('id', conversationId)
      .select('id, handoff_active, handoff_taken_by, handoff_started_at')
      .maybeSingle();

    if (error) {
      console.error('[handoff] take failed', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    console.log(`[handoff] taken | conv=${conversationId} | by=${takenBy}`);

    return NextResponse.json({ ok: true, conversation: data });
  }

  const { data, error } = await supabase
    .from('conversations')
    .update({
      handoff_active: false,
      handoff_taken_by: null,
      handoff_started_at: null,
    })
    .eq('id', conversationId)
    .select('id, handoff_active, handoff_taken_by, handoff_started_at')
    .maybeSingle();

  if (error) {
    console.error('[handoff] release failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  console.log(`[handoff] released | conv=${conversationId}`);

  return NextResponse.json({ ok: true, conversation: data });
}
