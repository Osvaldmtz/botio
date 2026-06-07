'use client';

import type { PipelineStats } from '../lib/pipeline-queries';
import { PIPELINE_STAGES } from '@/lib/pipeline';
import { STAGE_UI } from '../lib/pipeline-config';

type Props = { stats: PipelineStats };

export function PipelineStatsHeader({ stats }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Leads activos" value={String(stats.activeLeads)} />
        <StatCard
          label="Trial → Paid (30d)"
          value={`${stats.trialToPaidRate30d}%`}
        />
        <StatCard
          label="Avance hoy"
          value={String(stats.movedForwardToday)}
          hint={`ayer: ${stats.movedForwardYesterday}`}
        />
        <StatCard
          label="Velocidad"
          value={
            stats.movedForwardToday >= stats.movedForwardYesterday ? '↑' : '↓'
          }
          hint="vs ayer"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {PIPELINE_STAGES.filter((s) => s !== 'lost').map((stage) => (
          <span
            key={stage}
            className="rounded-full border border-bg-border px-2 py-1 text-[10px] text-fg-muted"
          >
            {STAGE_UI[stage].emoji} {STAGE_UI[stage].label}: ~
            {stats.avgDaysInStage[stage]}d
          </span>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-bg-border bg-bg-elevated px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-fg-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value}</p>
      {hint ? <p className="text-[10px] text-fg-muted">{hint}</p> : null}
    </div>
  );
}
