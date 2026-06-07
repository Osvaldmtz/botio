'use client';

import type { PipelineStats } from '../lib/pipeline-queries';
import { PIPELINE_STAGES } from '@/lib/pipeline';
import { STAGE_UI } from '../lib/pipeline-config';
import { StatsHeader } from '@/components/admin/stats-header';
import { Badge } from '@/components/ui/badge';

type Props = { stats: PipelineStats };

export function PipelineStatsHeader({ stats }: Props) {
  return (
    <div className="space-y-4">
      <StatsHeader
        items={[
          { key: 'active', label: 'Leads activos', value: String(stats.activeLeads) },
          {
            key: 'trial',
            label: 'Trial → Paid (30d)',
            value: `${stats.trialToPaidRate30d}%`,
          },
          {
            key: 'moved',
            label: 'Avance hoy',
            value: String(stats.movedForwardToday),
            hint: `ayer: ${stats.movedForwardYesterday}`,
            delta:
              stats.movedForwardToday >= stats.movedForwardYesterday ? 'up' : 'down',
          },
          {
            key: 'velocity',
            label: 'Velocidad',
            value: stats.movedForwardToday >= stats.movedForwardYesterday ? '↑' : '↓',
            hint: 'vs ayer',
          },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        {PIPELINE_STAGES.filter((s) => s !== 'lost').map((stage) => (
          <Badge key={stage} tone="gray">
            {STAGE_UI[stage].emoji} {STAGE_UI[stage].label}: ~{stats.avgDaysInStage[stage]}d
          </Badge>
        ))}
      </div>
    </div>
  );
}
