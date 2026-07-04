'use client';

import type { DashboardStats } from '../lib/conversation-queries';
import { StatsHeader } from '@/components/admin/stats-header';

type Props = {
  stats: DashboardStats;
};

export function ConversationStats({ stats }: Props) {
  return (
    <StatsHeader
      items={[
        { key: 'today', label: 'Activas hoy', value: String(stats.conversationsToday) },
        { key: 'new', label: 'Nuevas hoy', value: String(stats.newConversationsToday) },
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
    />
  );
}
