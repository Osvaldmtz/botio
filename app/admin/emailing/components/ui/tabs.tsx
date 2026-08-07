'use client';

import { cn } from '@/lib/cn';

export type KyTab = {
  id: string;
  label: string;
  icon?: React.ReactNode;
};

type Props = {
  items: KyTab[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

export function Tabs({ items, value, onChange, className }: Props) {
  return (
    <nav
      className={cn(
        'inline-flex items-center gap-1 rounded-ky-badge bg-transparent',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-ky-badge px-3.5 py-2 text-ky-sm font-medium transition-colors duration-150',
              active
                ? 'bg-ky-nav text-white'
                : 'text-ky-text-secondary hover:bg-ky-surface-1 hover:text-ky-text-primary',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
