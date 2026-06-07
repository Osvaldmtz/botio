'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';

export type TabItem = {
  href: string;
  label: string;
  active: boolean;
};

type Props = {
  items: TabItem[];
  className?: string;
};

export function Tabs({ items, className }: Props) {
  return (
    <nav className={cn('flex gap-6 overflow-x-auto', className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'shrink-0 border-b-2 pb-2.5 text-sm transition-colors duration-150',
            item.active
              ? 'border-accent font-medium text-fg'
              : 'border-transparent text-fg-muted hover:text-fg',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
