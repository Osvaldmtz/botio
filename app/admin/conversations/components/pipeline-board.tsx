'use client';

import { useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/pipeline';
import type { PipelineLead } from '../lib/pipeline-queries';
import { STAGE_UI } from '../lib/pipeline-config';
import { PipelineCard } from './pipeline-card';
import { cn } from '@/lib/cn';

type Grouped = Record<PipelineStage, PipelineLead[]>;

function resolveTargetStage(
  overId: string | number | undefined,
  collisions: DragEndEvent['collisions'],
): PipelineStage | null {
  const overKey = String(overId ?? '');
  if (PIPELINE_STAGES.includes(overKey as PipelineStage)) {
    return overKey as PipelineStage;
  }

  for (const collision of collisions ?? []) {
    const id = String(collision.id);
    if (PIPELINE_STAGES.includes(id as PipelineStage)) {
      return id as PipelineStage;
    }
  }

  return null;
}

type Props = {
  grouped: Grouped;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (
    conversationId: string,
    toStage: PipelineStage,
    fromStage: PipelineStage | null,
  ) => Promise<boolean>;
  activeDragId: string | null;
  setActiveDragId: (id: string | null) => void;
};

function PipelineColumn({
  stage,
  leads,
  selectedId,
  onSelect,
}: {
  stage: PipelineStage;
  leads: PipelineLead[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const ui = STAGE_UI[stage];
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex h-full min-w-[260px] max-w-[280px] flex-col border-r border-bg-border bg-bg-elevated',
        isOver && 'bg-accent-muted/20',
      )}
    >
      <div className="flex items-center justify-between border-b border-bg-border px-3 py-3">
        <span className="text-sm font-medium text-fg">
          {ui.emoji} {ui.label}
        </span>
        <span className="text-xs tabular-nums text-fg-tertiary">{leads.length}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {leads.map((lead) => (
          <PipelineCard
            key={lead.id}
            lead={lead}
            selected={selectedId === lead.id}
            onSelect={onSelect}
          />
        ))}
        {leads.length === 0 ? (
          <p className="py-8 text-center text-xs text-fg-tertiary">Sin leads</p>
        ) : null}
      </div>
    </div>
  );
}

export function PipelineBoard({
  grouped,
  selectedId,
  onSelect,
  onMove,
  activeDragId,
  setActiveDragId,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const activeLead = useMemo(() => {
    if (!activeDragId) return null;
    for (const stage of PIPELINE_STAGES) {
      const found = grouped[stage].find((l) => l.id === activeDragId);
      if (found) return found;
    }
    return null;
  }, [activeDragId, grouped]);

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over, collisions } = event;

    const toStage = resolveTargetStage(over?.id, collisions);
    if (!toStage) return;

    const conversationId = String(active.id);
    const fromStage = (active.data.current?.stage as PipelineStage) ?? null;
    if (fromStage === toStage) return;

    await onMove(conversationId, toStage, fromStage);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e) => setActiveDragId(String(e.active.id))}
      onDragEnd={(e) => void handleDragEnd(e)}
      onDragCancel={() => setActiveDragId(null)}
    >
      <div className="flex h-full overflow-x-auto rounded-card border border-bg-border">
        {PIPELINE_STAGES.map((stage) => (
          <PipelineColumn
            key={stage}
            stage={stage}
            leads={grouped[stage]}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? (
          <div className="w-[260px] opacity-80 transition-opacity duration-100">
            <PipelineCard lead={activeLead} selected={false} onSelect={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
