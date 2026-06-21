'use client';

import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CategoryBadge } from './category-badge';
import { CATEGORY_CONFIG, type Task } from '@/lib/tasks/types';
import { cn } from '@/lib/cn';

type Props = {
  tasks: Task[];
};

export function TasksCalendarView({ tasks }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(new Date('2026-06-21')));
  const [selectedDay, setSelectedDay] = useState<string | null>('2026-06-21');

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.due_date) continue;
      const list = map.get(task.due_date) ?? [];
      list.push(task);
      map.set(task.due_date, list);
    }
    return map;
  }, [tasks]);

  const selectedTasks = selectedDay ? (tasksByDate.get(selectedDay) ?? []) : [];

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1 rounded-card border border-bg-border bg-bg p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold capitalize text-fg">
            {format(month, 'MMMM yyyy', { locale: es })}
          </h3>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded p-1 hover:bg-bg-subtle"
              onClick={() => setMonth((m) => addMonths(m, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded p-1 hover:bg-bg-subtle"
              onClick={() => setMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-fg-tertiary">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayTasks = tasksByDate.get(key) ?? [];
            const inMonth = isSameMonth(day, month);
            const selected = selectedDay === key;
            const isToday = isSameDay(day, new Date());

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDay(key)}
                className={cn(
                  'min-h-[72px] rounded border p-1 text-left transition-colors',
                  inMonth ? 'border-bg-border bg-bg-elevated' : 'border-transparent bg-bg-subtle/50',
                  selected && 'border-accent ring-1 ring-accent-muted',
                  isToday && !selected && 'border-accent/40',
                )}
              >
                <span
                  className={cn(
                    'text-xs font-medium',
                    inMonth ? 'text-fg' : 'text-fg-tertiary',
                    isToday && 'text-accent',
                  )}
                >
                  {format(day, 'd')}
                </span>
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {dayTasks.slice(0, 3).map((task) => (
                    <span
                      key={task.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: CATEGORY_CONFIG[task.category].color }}
                      title={task.title}
                    />
                  ))}
                  {dayTasks.length > 3 ? (
                    <span className="text-[10px] text-fg-muted">+{dayTasks.length - 3}</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="w-full shrink-0 rounded-card border border-bg-border bg-bg-elevated p-4 lg:w-80">
        <h3 className="text-sm font-semibold text-fg">
          {selectedDay
            ? format(parseISO(`${selectedDay}T00:00:00`), 'EEEE d MMM', { locale: es })
            : 'Selecciona un día'}
        </h3>
        <div className="mt-3 space-y-2">
          {selectedTasks.length === 0 ? (
            <p className="text-sm text-fg-muted">Sin tareas este día.</p>
          ) : (
            selectedTasks.map((task) => (
              <div key={task.id} className="rounded border border-bg-border bg-bg p-3">
                <p className="text-sm font-medium text-fg">{task.title}</p>
                <div className="mt-2">
                  <CategoryBadge category={task.category} />
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
