import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  completeRoadmapReminder,
  dismissRoadmapReminder,
  postponeRoadmapReminder,
} from '@/lib/roadmap-reminders';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

type ActionBody = {
  action?: 'complete' | 'postpone' | 'dismiss';
};

export async function POST(request: Request, { params }: Params) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = body.action;
  if (action !== 'complete' && action !== 'postpone' && action !== 'dismiss') {
    return NextResponse.json(
      { error: 'action must be complete, postpone, or dismiss' },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminClient();
    let reminder = null;

    if (action === 'complete') {
      reminder = await completeRoadmapReminder(supabase, params.id);
    } else if (action === 'dismiss') {
      reminder = await dismissRoadmapReminder(supabase, params.id);
    } else {
      reminder = await postponeRoadmapReminder(supabase, params.id, 30);
    }

    if (!reminder) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    console.log(`[roadmap] ${action} | id=${params.id}`);
    return NextResponse.json({ ok: true, reminder });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
