'use client';

import { cn } from '@/lib/cn';

export type StatItem = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  delta?: 'up' | 'down' | 'neutral';
};

type Props = {
  items: StatItem[];
  className?: string;
  onItemClick?: (key: string) => void;
  activeKeys?: string[];
};

export function StatsHeader({ items, className, onItemClick, activeKeys = [] }: Props) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-stretch divide-x divide-bg-border border-y border-bg-border py-4',
        className,
      )}
    >
      {items.map((item) => {
        const clickable = Boolean(onItemClick) && (item.key === 'today' || item.key === 'new');
        const active = activeKeys.includes(item.key);
        const Wrapper = clickable ? 'button' : 'div';
        return (
          <Wrapper
            key={item.key}
            type={clickable ? 'button' : undefined}
            onClick={clickable ? () => onItemClick?.(item.key) : undefined}
            className={cn(
              'min-w-[120px] flex-1 px-4 text-left first:pl-0 last:pr-0',
              clickable && 'cursor-pointer rounded-md transition-colors hover:bg-bg-subtle',
              active && clickable && 'bg-accent-muted/20',
            )}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-fg-tertiary">
              {item.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-fg">
              {item.value}
            </p>
            {item.hint ? (
              <p
                className={cn(
                  'mt-0.5 text-xs text-fg-muted',
                  item.delta === 'up' && 'text-accent-muted-fg',
                  item.delta === 'down' && 'text-semantic-hot',
                )}
              >
                {item.hint}
              </p>
            ) : null}
          </Wrapper>
        );
      })}
    </div>
  );
}
