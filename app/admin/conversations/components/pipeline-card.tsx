'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { PipelineLead } from '../lib/pipeline-queries';
import {
  avatarLabel,
  extractLeadName,
  formatRelativeTime,
  temperatureBadge,
} from '../lib/format';
import { differenceInDays } from 'date-fns';

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
    opacity: isDragging ? 0.5 : 1,
  };

  const temp = temperatureBadge(lead.lead_temperature);
  const title = extractLeadName(lead.customer_phone, lead.lead_signals);
  const daysInStage = lead.pipeline_stage_updated_at
    ? differenceInDays(new Date(), new Date(lead.pipeline_stage_updated_at))
    : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border p-3 transition-colors ${
        selected
          ? 'border-accent/50 bg-accent/5'
          : 'border-bg-border bg-bg hover:border-fg-muted/30'
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-full border border-bg-border bg-bg text-xs active:cursor-grabbing"
          {...listeners}
          {...attributes}
          aria-label="Arrastrar tarjeta"
        >
          {avatarLabel(lead.customer_phone, lead.lead_temperature)}
        </button>
        <button
          type="button"
          onClick={() => onSelect(lead.id)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-sm font-medium text-fg">{title}</p>
          <p className="font-mono text-[10px] text-fg-muted">{lead.customer_phone}</p>
          {lead.lead_city ? (
            <p className="mt-0.5 text-[10px] text-fg-muted">📍 {lead.lead_city}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1">
            {temp ? (
              <span
                className={`rounded-full border px-1.5 py-0.5 text-[9px] ${temp.className}`}
              >
                {temp.label}
                {lead.lead_score !== null ? ` ${lead.lead_score}` : ''}
              </span>
            ) : null}
            <span className="text-[9px] text-fg-muted">{daysInStage}d en etapa</span>
            <span className="text-[9px] text-fg-muted">
              {formatRelativeTime(lead.last_message_at)}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
