'use client';

import type { DashboardStats } from '../lib/conversation-queries';

type Props = {
  stats: DashboardStats;
};

const items: Array<{
  key: keyof DashboardStats;
  label: string;
  emoji?: string;
  format?: (v: number) => string;
}> = [
  { key: 'conversationsToday', label: 'Conversaciones hoy' },
  { key: 'hotLeadsToday', label: 'Hot leads hoy', emoji: '🔥' },
  { key: 'activeLastHour', label: 'Activas última hora' },
  { key: 'unanswered', label: 'Sin responder' },
  {
    key: 'conversionRate',
    label: 'Conversión del día',
    format: (v) => `${v}%`,
  },
];

export function ConversationStats({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {items.map((item) => {
        const raw = stats[item.key];
        const value = item.format ? item.format(raw) : String(raw);
        return (
          <div
            key={item.key}
            className="rounded-xl border border-bg-border bg-bg-elevated px-4 py-3"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">
              {item.emoji ? `${item.emoji} ` : ''}
              {item.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value}</p>
          </div>
        );
      })}
    </div>
  );
}
