'use client';

import type { TaskStats } from '@/lib/tasks/types';

type Props = {
  stats: TaskStats;
};

export function TasksStatsBar({ stats }: Props) {
  const pills: Array<{ label: string; value: number; tone?: 'danger' }> = [
    { label: 'por hacer', value: stats.todo },
    { label: 'en progreso', value: stats.in_progress },
    { label: 'vencidas', value: stats.overdue, tone: stats.overdue > 0 ? 'danger' : undefined },
    { label: 'completadas este mes', value: stats.completedThisMonth },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {pills.map((pill) => (
        <div
          key={pill.label}
          className={
            pill.tone === 'danger'
              ? 'rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-700'
              : 'rounded-full border border-bg-border bg-bg-elevated px-3 py-1 text-sm text-fg-muted'
          }
        >
          <span className="font-semibold tabular-nums text-fg">{pill.value}</span>{' '}
          {pill.label}
        </div>
      ))}
    </div>
  );
}
