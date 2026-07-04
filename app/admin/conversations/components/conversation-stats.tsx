'use client';

import type { DashboardStats } from '../lib/conversation-queries';
import type { DayViewFilter } from '../lib/conversation-queries';
import { StatsHeader } from '@/components/admin/stats-header';

type Props = {
  stats: DashboardStats;
  dayView: DayViewFilter;
  onDayViewChange: (view: DayViewFilter) => void;
};

export function ConversationStats({ stats, dayView, onDayViewChange }: Props) {
  return (
    <StatsHeader
      items={[
        {
          key: 'today',
          label: 'Activas hoy',
          value: String(stats.conversationsToday),
          hint: dayView === 'active_today' ? 'Vista actual' : 'Ver lista',
          delta: dayView === 'active_today' ? 'neutral' : undefined,
        },
        {
          key: 'new',
          label: 'Nuevas hoy',
          value: String(stats.newConversationsToday),
          hint: dayView === 'new_today' ? 'Vista actual' : 'Ver lista',
          delta: dayView === 'new_today' ? 'neutral' : undefined,
        },
        { key: 'hot', label: 'Hot leads hoy', value: String(stats.hotLeadsToday) },
        { key: 'active', label: 'Activas última hora', value: String(stats.activeLastHour) },
        {
          key: 'unanswered',
          label: 'Sin responder',
          value: String(stats.unanswered),
          delta: stats.unanswered > 0 ? 'down' : 'neutral',
        },
        {
          key: 'conversion',
          label: 'Conversión del día',
          value: `${stats.conversionRate}%`,
        },
      ]}
      onItemClick={(key) => {
        if (key === 'today') onDayViewChange('active_today');
        if (key === 'new') onDayViewChange('new_today');
      }}
      activeKeys={dayView === 'active_today' ? ['today'] : dayView === 'new_today' ? ['new'] : []}
    />
  );
}
