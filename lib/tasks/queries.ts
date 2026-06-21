import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Task, TaskStats } from '@/lib/tasks/types';
import { todayDateString } from '@/lib/tasks/utils';

export async function fetchTaskStats(supabase: SupabaseClient): Promise<TaskStats> {
  const today = todayDateString();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [todoRes, inProgressRes, overdueRes, completedRes] = await Promise.all([
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'todo'),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'in_progress'),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'done')
      .not('due_date', 'is', null)
      .lt('due_date', today),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'done')
      .gte('updated_at', `${monthStart}T00:00:00.000Z`),
  ]);

  return {
    todo: todoRes.count ?? 0,
    in_progress: inProgressRes.count ?? 0,
    overdue: overdueRes.count ?? 0,
    completedThisMonth: completedRes.count ?? 0,
  };
}

export async function fetchOverdueCount(supabase: SupabaseClient): Promise<number> {
  const stats = await fetchTaskStats(supabase);
  return stats.overdue;
}

export type TaskListFilters = {
  status?: string;
  category?: string;
  from_date?: string;
  to_date?: string;
};

export async function fetchTasks(
  supabase: SupabaseClient,
  filters: TaskListFilters = {},
): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('priority', { ascending: true });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.from_date) query = query.gte('due_date', filters.from_date);
  if (filters.to_date) query = query.lte('due_date', filters.to_date);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Task[];
}
