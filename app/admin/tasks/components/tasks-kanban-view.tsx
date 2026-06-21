'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { CategoryBadge } from './category-badge';
import {
  KANBAN_COLUMNS,
  STATUS_LABELS,
  type Task,
  type TaskStatus,
} from '@/lib/tasks/types';
import { dueDateTone, formatDueDate, priorityDotClass } from '@/lib/tasks/utils';
import { cn } from '@/lib/cn';

type Props = {
  tasks: Task[];
  onStatusChange: (id: string, status: TaskStatus) => Promise<void>;
};

function KanbanCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const tone = dueDateTone(task.due_date, task.status);

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={cn(
        'cursor-grab rounded border border-bg-border bg-bg p-3 shadow-sm active:cursor-grabbing',
        isDragging && 'opacity-50',
      )}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-start gap-2">
        <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', priorityDotClass(task.priority))} />
        <p className="flex-1 text-sm font-medium text-fg">{task.title}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <CategoryBadge category={task.category} />
        <span
          className={cn(
            'text-xs tabular-nums',
            tone === 'overdue' && 'text-red-600',
            tone === 'today' && 'text-amber-600',
            tone === 'default' && 'text-fg-muted',
          )}
        >
          {formatDueDate(task.due_date)}
        </span>
      </div>
    </div>
  );
}

function KanbanColumn({
  status,
  tasks,
}: {
  status: TaskStatus;
  tasks: Task[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[420px] min-w-[240px] flex-1 flex-col rounded-card border border-bg-border bg-bg-elevated',
        isOver && 'bg-accent-muted/20',
      )}
    >
      <div className="flex items-center justify-between border-b border-bg-border px-3 py-3">
        <span className="text-sm font-medium text-fg">{STATUS_LABELS[status]}</span>
        <span className="text-xs tabular-nums text-fg-tertiary">{tasks.length}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {tasks.map((task) => (
          <KanbanCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 ? (
          <p className="py-8 text-center text-xs text-fg-tertiary">Sin tareas</p>
        ) : null}
      </div>
    </div>
  );
}

export function TasksKanbanView({ tasks, onStatusChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      blocked: [],
      done: [],
    };
    for (const task of tasks) {
      map[task.status].push(task);
    }
    return map;
  }, [tasks]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const taskId = String(event.active.id);
    const overId = event.over?.id;
    if (!overId) return;

    const targetStatus = String(overId) as TaskStatus;
    if (!KANBAN_COLUMNS.includes(targetStatus)) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    await onStatusChange(taskId, targetStatus);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {KANBAN_COLUMNS.map((status) => (
          <KanbanColumn key={status} status={status} tasks={grouped[status]} />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="w-[240px] rounded border border-bg-border bg-bg p-3 shadow-md">
            <p className="text-sm font-medium text-fg">{activeTask.title}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
