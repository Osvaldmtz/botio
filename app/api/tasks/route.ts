import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { fetchTaskStats, fetchTasks } from '@/lib/tasks/queries';
import { TASK_CATEGORIES, TASK_STATUSES } from '@/lib/tasks/types';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statsOnly = searchParams.get('stats_only') === '1';

  const supabase = createAdminClient();

  try {
    if (statsOnly) {
      const stats = await fetchTaskStats(supabase);
      return NextResponse.json({ stats });
    }

    const filters = {
      status: searchParams.get('status') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      from_date: searchParams.get('from_date') ?? undefined,
      to_date: searchParams.get('to_date') ?? undefined,
    };

    const [tasks, stats] = await Promise.all([
      fetchTasks(supabase, filters),
      fetchTaskStats(supabase),
    ]);

    return NextResponse.json({ tasks, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/tasks] GET failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type CreateBody = {
  title?: string;
  description?: string;
  category?: string;
  priority?: number;
  due_date?: string | null;
  status?: string;
};

export async function POST(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const category = body.category?.trim();
  if (!category || !TASK_CATEGORIES.includes(category as (typeof TASK_CATEGORIES)[number])) {
    return NextResponse.json({ error: 'invalid category' }, { status: 400 });
  }

  const priority = body.priority ?? 3;
  if (priority < 1 || priority > 4) {
    return NextResponse.json({ error: 'priority must be 1-4' }, { status: 400 });
  }

  const status = body.status ?? 'todo';
  if (!TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title,
      description: body.description?.trim() || null,
      category,
      priority,
      due_date: body.due_date || null,
      status,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[api/tasks] POST failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stats = await fetchTaskStats(supabase);
  return NextResponse.json({ task: data, stats }, { status: 201 });
}
