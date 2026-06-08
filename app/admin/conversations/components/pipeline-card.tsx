'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { PipelineLead } from '../lib/pipeline-queries';
import {
  avatarLabel,
  extractLeadName,
  formatRelativeTime,
  temperatureBadge,
} from '../lib/format';
import { Badge } from '@/components/ui/badge';
import { differenceInDays } from 'date-fns';
import { cn } from '@/lib/cn';
import {
  formatClosureLabel,
  type ClosureReason,
} from '@/lib/conversation-closure-constants';

type Props = {
  lead: PipelineLead;
  selected: boolean;
  onSelect: (id: string) => void;
};

export function PipelineCard({ lead, selected, onSelect }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { stage: lead.pipeline_stage },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
  };

  const temp = temperatureBadge(lead.lead_temperature);
  const title = extractLeadName(lead.customer_phone, lead.lead_signals);
  const daysInStage = lead.pipeline_stage_updated_at
    ? differenceInDays(new Date(), new Date(lead.pipeline_stage_updated_at))
    : 0;
  const adminClosed = Boolean(lead.closure_reason);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-card border bg-bg p-3 transition-colors duration-150',
        selected ? 'border-accent bg-accent-muted/20' : 'border-bg-border hover:border-bg-border-hover',
        adminClosed && !selected && 'border-dashed opacity-80',
        isDragging && 'cursor-grabbing',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 flex shrink-0 cursor-grab items-center text-fg-tertiary active:cursor-grabbing"
          {...listeners}
          {...attributes}
          aria-label="Arrastrar tarjeta"
        >
          <GripVertical className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-[10px] font-medium text-fg-muted">
          {avatarLabel(lead.customer_phone, lead.lead_temperature)}
        </div>

        <button type="button" onClick={() => onSelect(lead.id)} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium text-fg">{title}</p>
          <p className="truncate font-mono text-[11px] text-fg-tertiary">{lead.customer_phone}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {temp ? (
              <Badge tone={temp.tone === 'hot' ? 'hot' : temp.tone === 'warm' ? 'warning' : 'gray'}>
                {temp.label}
              </Badge>
            ) : null}
            <span className="text-[11px] text-fg-tertiary">{daysInStage}d en etapa</span>
            <span className="text-[11px] text-fg-tertiary">
              {formatRelativeTime(lead.last_message_at)}
            </span>
            {adminClosed && lead.closure_reason ? (
              <Badge tone="gray">
                {formatClosureLabel(lead.closure_reason as ClosureReason)}
              </Badge>
            ) : null}
          </div>
        </button>
      </div>
    </div>
  );
}
