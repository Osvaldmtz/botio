import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { fetchTaskStats } from '@/lib/tasks/queries';
import { TASK_CATEGORIES, TASK_STATUSES } from '@/lib/tasks/types';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

type PatchBody = {
  title?: string;
  description?: string | null;
  category?: string;
  status?: string;
  priority?: number;
  due_date?: string | null;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 });
    updates.title = title;
  }

  if (body.description !== undefined) {
    updates.description = body.description?.trim() || null;
  }

  if (body.category !== undefined) {
    if (!TASK_CATEGORIES.includes(body.category as (typeof TASK_CATEGORIES)[number])) {
      return NextResponse.json({ error: 'invalid category' }, { status: 400 });
    }
    updates.category = body.category;
  }

  if (body.status !== undefined) {
    if (!TASK_STATUSES.includes(body.status as (typeof TASK_STATUSES)[number])) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }
    updates.status = body.status;
  }

  if (body.priority !== undefined) {
    if (body.priority < 1 || body.priority > 4) {
      return NextResponse.json({ error: 'priority must be 1-4' }, { status: 400 });
    }
    updates.priority = body.priority;
  }

  if (body.due_date !== undefined) {
    updates.due_date = body.due_date || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', params.id)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[api/tasks] PATCH failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const stats = await fetchTaskStats(supabase);
  return NextResponse.json({ task: data, stats });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('tasks').delete().eq('id', params.id);

  if (error) {
    console.error('[api/tasks] DELETE failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stats = await fetchTaskStats(supabase);
  return NextResponse.json({ success: true, stats });
}
