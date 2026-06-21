import 'server-only';
import { LoginForm } from '@/components/admin/login-form';
import { isAdmin } from '@/lib/admin-auth';
import { fetchTaskStats, fetchTasks } from '@/lib/tasks/queries';
import { createAdminClient } from '@/lib/supabase/admin';
import { TasksDashboard } from './components/tasks-dashboard';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  if (!isAdmin()) return <LoginForm />;

  const supabase = createAdminClient();
  const [tasks, stats] = await Promise.all([
    fetchTasks(supabase),
    fetchTaskStats(supabase),
  ]);

  return <TasksDashboard initial={{ tasks, stats }} />;
}
