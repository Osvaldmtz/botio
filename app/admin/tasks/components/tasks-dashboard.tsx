'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { AdminShell } from '@/components/admin/admin-shell';
import { Button } from '@/components/ui/button';
import { TaskForm } from './task-form';
import { TasksCalendarView } from './tasks-calendar-view';
import { TasksKanbanView } from './tasks-kanban-view';
import { TasksListView } from './tasks-list-view';
import { TasksStatsBar } from './tasks-stats-bar';
import type { Task, TaskStats, TaskStatus } from '@/lib/tasks/types';
import { CATEGORY_CONFIG, TASK_CATEGORIES } from '@/lib/tasks/types';
import { cn } from '@/lib/cn';

type ViewMode = 'list' | 'kanban' | 'calendar';

type Props = {
  initial: {
    tasks: Task[];
    stats: TaskStats;
  };
};

const STATUS_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'todo', label: 'Por hacer' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'done', label: 'Listas' },
  { value: 'blocked', label: 'Bloqueadas' },
] as const;

const CATEGORY_FILTERS = [
  { value: '', label: 'Todas' },
  ...TASK_CATEGORIES.map((cat) => ({ value: cat, label: CATEGORY_CONFIG[cat].label })),
];

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'list', label: 'Lista' },
  { value: 'kanban', label: 'Kanban' },
  { value: 'calendar', label: 'Calendario' },
];

export function TasksDashboard({ initial }: Props) {
  const [tasks, setTasks] = useState(initial.tasks);
  const [stats, setStats] = useState(initial.stats);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [view, setView] = useState<ViewMode>('list');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    const res = await fetch(`/api/tasks?${params.toString()}`);
    if (!res.ok) return;
    const data = (await res.json()) as { tasks: Task[]; stats: TaskStats };
    setTasks(data.tasks);
    setStats(data.stats);
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredTasks = useMemo(() => tasks, [tasks]);

  async function patchTask(id: string, patch: Partial<Task>) {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { task: Task; stats: TaskStats };
      setTasks((prev) => prev.map((t) => (t.id === id ? data.task : t)));
      setStats(data.stats);
    } finally {
      setLoading(false);
    }
  }

  async function deleteTask(id: string) {
    if (!window.confirm('¿Eliminar esta tarea?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      const data = (await res.json()) as { stats: TaskStats };
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setStats(data.stats);
    } finally {
      setLoading(false);
    }
  }

  async function createTask(payload: {
    title: string;
    description: string;
    category: string;
    priority: number;
    due_date: string;
    status: TaskStatus;
  }) {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: payload.title,
          description: payload.description || null,
          category: payload.category,
          priority: payload.priority,
          due_date: payload.due_date || null,
          status: payload.status,
        }),
      });
      if (!res.ok) return;
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell
      title="Tareas"
      actions={
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" />
          Nueva tarea
        </Button>
      }
    >
      <TasksStatsBar stats={stats} />

      <TaskForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={createTask}
        loading={loading}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value || 'all-status'}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === f.value
                  ? 'bg-accent text-white'
                  : 'bg-bg-subtle text-fg-muted hover:text-fg',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.value || 'all-cat'}
              type="button"
              onClick={() => setCategoryFilter(f.value)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                categoryFilter === f.value
                  ? 'bg-accent text-white'
                  : 'bg-bg-subtle text-fg-muted hover:text-fg',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 rounded border border-bg-border bg-bg-subtle p-0.5">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setView(opt.value)}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                view === opt.value ? 'bg-bg text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={loading ? 'pointer-events-none opacity-70' : undefined}>
        {view === 'list' ? (
          <TasksListView
            tasks={filteredTasks}
            onUpdate={patchTask}
            onDelete={deleteTask}
          />
        ) : null}
        {view === 'kanban' ? (
          <TasksKanbanView
            tasks={filteredTasks}
            onStatusChange={(id, status) => patchTask(id, { status })}
          />
        ) : null}
        {view === 'calendar' ? <TasksCalendarView tasks={filteredTasks} /> : null}
      </div>
    </AdminShell>
  );
}
