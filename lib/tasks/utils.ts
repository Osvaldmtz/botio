import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { PLAN_START_DATE, type Task, type TaskStatus } from '@/lib/tasks/types';

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dueDateTone(
  dueDate: string | null,
  status: TaskStatus,
): 'overdue' | 'today' | 'default' {
  if (!dueDate || status === 'done') return 'default';
  const today = todayDateString();
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'today';
  return 'default';
}

export function priorityDotClass(priority: number): string {
  if (priority === 1) return 'bg-red-500';
  if (priority === 2) return 'bg-orange-500';
  if (priority === 3) return 'bg-yellow-500';
  return 'bg-fg-tertiary';
}

export function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return '—';
  try {
    return format(parseISO(dueDate), 'd MMM yyyy', { locale: es });
  } catch {
    return dueDate;
  }
}

export type WeekGroup = {
  key: string;
  weekNum: number;
  label: string;
  tasks: Task[];
};

export function groupTasksByWeek(tasks: Task[]): WeekGroup[] {
  const planStart = parseISO(`${PLAN_START_DATE}T00:00:00.000Z`);
  const buckets = new Map<string, WeekGroup>();

  for (const task of tasks) {
    const due = task.due_date ?? PLAN_START_DATE;
    const dueDate = parseISO(`${due}T00:00:00.000Z`);
    const diffDays = Math.floor((dueDate.getTime() - planStart.getTime()) / 86400000);
    const weekNum = Math.max(1, Math.floor(diffDays / 7) + 1);
    const weekStart = new Date(planStart);
    weekStart.setUTCDate(planStart.getUTCDate() + (weekNum - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

    const label = `Semana ${weekNum} — ${format(weekStart, 'MMM d', { locale: es })}-${format(weekEnd, 'd', { locale: es })}`;
    const key = `week-${weekNum}`;

    const bucket = buckets.get(key) ?? { key, weekNum, label, tasks: [] };
    bucket.tasks.push(task);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values()).sort((a, b) => a.weekNum - b.weekNum);
}

export function toggleDoneStatus(status: TaskStatus): TaskStatus {
  return status === 'done' ? 'todo' : 'done';
}
