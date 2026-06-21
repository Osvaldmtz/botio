'use client';

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CategoryBadge } from './category-badge';
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_CATEGORIES,
  CATEGORY_CONFIG,
  type Task,
  type TaskCategory,
  type TaskStatus,
} from '@/lib/tasks/types';
import {
  dueDateTone,
  formatDueDate,
  priorityDotClass,
  toggleDoneStatus,
} from '@/lib/tasks/utils';
import { cn } from '@/lib/cn';

const fieldClass =
  'w-full rounded border border-bg-border bg-bg px-3 py-2 text-sm text-fg transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted';

type Props = {
  task: Task;
  onUpdate: (id: string, patch: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

function statusTone(status: TaskStatus): 'default' | 'primary' | 'warning' | 'gray' {
  if (status === 'done') return 'primary';
  if (status === 'in_progress') return 'warning';
  if (status === 'blocked') return 'gray';
  return 'default';
}

export function TaskRow({ task, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description ?? '');
  const [editCategory, setEditCategory] = useState(task.category);
  const [editPriority, setEditPriority] = useState(task.priority);
  const [editDueDate, setEditDueDate] = useState(task.due_date ?? '');
  const [editStatus, setEditStatus] = useState(task.status);

  const tone = dueDateTone(task.due_date, task.status);
  const isDone = task.status === 'done';

  async function handleToggleDone() {
    await onUpdate(task.id, { status: toggleDoneStatus(task.status) });
  }

  async function handleSaveEdit() {
    await onUpdate(task.id, {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      category: editCategory,
      priority: editPriority,
      due_date: editDueDate || null,
      status: editStatus,
    });
    setExpanded(false);
  }

  return (
    <div className="rounded border border-bg-border bg-bg px-3 py-2">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={handleToggleDone}
          className={cn(
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
            isDone ? 'border-accent bg-accent text-white' : 'border-bg-border bg-bg hover:border-accent',
          )}
          aria-label={isDone ? 'Marcar pendiente' : 'Marcar completada'}
        >
          {isDone ? '✓' : null}
        </button>

        <span
          className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', priorityDotClass(task.priority))}
          title={PRIORITY_LABELS[task.priority]}
        />

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              'text-left text-sm font-medium text-fg hover:text-accent',
              isDone && 'line-through text-fg-muted',
            )}
          >
            {task.title}
          </button>
        </div>

        <CategoryBadge category={task.category} />

        <span
          className={cn(
            'shrink-0 text-xs tabular-nums',
            tone === 'overdue' && 'font-medium text-red-600',
            tone === 'today' && 'font-medium text-amber-600',
            tone === 'default' && 'text-fg-muted',
          )}
        >
          {formatDueDate(task.due_date)}
        </span>

        <Badge tone={statusTone(task.status)}>{STATUS_LABELS[task.status]}</Badge>

        <div className="relative">
          <button
            type="button"
            className="rounded p-1 text-fg-muted hover:bg-bg-subtle hover:text-fg"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
                aria-label="Cerrar menú"
              />
              <div className="absolute right-0 z-20 mt-1 w-40 rounded border border-bg-border bg-bg py-1 shadow-sm">
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-bg-subtle"
                  onClick={() => {
                    setMenuOpen(false);
                    setExpanded(true);
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-bg-subtle"
                  onClick={async () => {
                    setMenuOpen(false);
                    await onUpdate(task.id, { status: 'blocked' });
                  }}
                >
                  Marcar bloqueada
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-bg-subtle"
                  onClick={async () => {
                    setMenuOpen(false);
                    await onDelete(task.id);
                  }}
                >
                  Eliminar
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-bg-border pt-3 pl-10">
          {task.description ? (
            <p className="whitespace-pre-wrap text-sm text-fg-muted">{task.description}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-fg-muted">Título</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-fg-muted">Fecha límite</label>
              <Input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-fg-muted">Descripción</label>
              <textarea
                className={cn(fieldClass, 'min-h-[72px]')}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-fg-muted">Categoría</label>
              <select
                className={fieldClass}
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as TaskCategory)}
              >
                {TASK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_CONFIG[cat].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-fg-muted">Prioridad</label>
              <select
                className={fieldClass}
                value={editPriority}
                onChange={(e) => setEditPriority(Number(e.target.value))}
              >
                {[1, 2, 3, 4].map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-fg-muted">Estado</label>
              <select
                className={fieldClass}
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(false)}>
              Cerrar
            </Button>
            <Button type="button" size="sm" onClick={handleSaveEdit}>
              Guardar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
