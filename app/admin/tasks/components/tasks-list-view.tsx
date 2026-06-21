'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TaskRow } from './task-row';
import type { Task } from '@/lib/tasks/types';
import { groupTasksByWeek } from '@/lib/tasks/utils';

type Props = {
  tasks: Task[];
  onUpdate: (id: string, patch: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function TasksListView({ tasks, onUpdate, onDelete }: Props) {
  const weeks = groupTasksByWeek(tasks);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (tasks.length === 0) {
    return <p className="py-12 text-center text-sm text-fg-muted">No hay tareas para estos filtros.</p>;
  }

  return (
    <div className="space-y-4">
      {weeks.map((week) => {
        const isCollapsed = collapsed[week.key] ?? false;
        return (
          <section key={week.key} className="rounded-card border border-bg-border bg-bg">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left"
              onClick={() =>
                setCollapsed((prev) => ({ ...prev, [week.key]: !isCollapsed }))
              }
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-fg-muted" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-fg-muted" />
                )}
                {week.label}
              </span>
              <span className="text-xs tabular-nums text-fg-muted">{week.tasks.length}</span>
            </button>
            {!isCollapsed ? (
              <div className="space-y-2 border-t border-bg-border p-3">
                {week.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} onUpdate={onUpdate} onDelete={onDelete} />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
