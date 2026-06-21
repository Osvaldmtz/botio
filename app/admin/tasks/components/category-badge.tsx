'use client';

import { CATEGORY_CONFIG, type TaskCategory } from '@/lib/tasks/types';
import { cn } from '@/lib/cn';

type Props = {
  category: TaskCategory;
  className?: string;
};

export function CategoryBadge({ category, className }: Props) {
  const config = CATEGORY_CONFIG[category];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white',
        className,
      )}
      style={{ backgroundColor: config.color }}
    >
      {config.shortLabel}
    </span>
  );
}
