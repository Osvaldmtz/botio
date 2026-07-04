'use client';

import type { DayViewFilter } from '../lib/conversation-queries';
import type { DashboardStats } from '../lib/conversation-queries';
import { cn } from '@/lib/cn';

const TABS: Array<{ id: DayViewFilter; label: string; countKey: keyof DashboardStats | null }> = [
  { id: 'active_today', label: 'Activas hoy', countKey: 'conversationsToday' },
  { id: 'new_today', label: 'Nuevas hoy', countKey: 'newConversationsToday' },
  { id: 'all', label: 'Todas', countKey: null },
];

type Props = {
  value: DayViewFilter;
  stats: DashboardStats;
  onChange: (view: DayViewFilter) => void;
};

export function ConversationDayViewTabs({ value, stats, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-bg-border pb-3">
      {TABS.map((tab) => {
        const count =
          tab.countKey != null ? stats[tab.countKey] : null;
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-accent text-white shadow-sm'
                : 'bg-bg-subtle text-fg-muted hover:bg-bg-elevated hover:text-fg',
            )}
          >
            {tab.label}
            {count != null ? (
              <span
                className={cn(
                  'ml-1.5 tabular-nums',
                  active ? 'text-white/90' : 'text-fg-tertiary',
                )}
              >
                ({count})
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export type { DayViewFilter };
