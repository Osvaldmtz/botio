import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  CONVERSATION_OUTCOMES,
  isConversationOutcome,
  setConversationOutcome,
} from '@/lib/conversation-outcome';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

type OutcomeBody = {
  outcome?: string;
  notes?: string;
};

export async function POST(request: Request, { params }: Params) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: OutcomeBody;
  try {
    body = (await request.json()) as OutcomeBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const outcome = body.outcome?.trim();
  if (!outcome || !isConversationOutcome(outcome)) {
    return NextResponse.json(
      {
        error: 'Invalid outcome',
        allowed: CONVERSATION_OUTCOMES,
      },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const result = await setConversationOutcome(supabase, {
    conversationId: params.id,
    outcome,
    source: 'admin_manual',
    notes: body.notes,
    force: true,
  });

  if (result.updated === 0) {
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', params.id)
      .maybeSingle();

    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Outcome not updated' }, { status: 500 });
  }

  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('id, outcome, outcome_date, outcome_source, metadata')
    .eq('id', params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[outcome] manual | conv=${params.id} | outcome=${outcome}`);

  return NextResponse.json({ ok: true, conversation });
}
