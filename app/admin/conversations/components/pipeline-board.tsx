'use client';

import { useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/pipeline';
import type { PipelineLead } from '../lib/pipeline-queries';
import { STAGE_UI } from '../lib/pipeline-config';
import { PipelineCard } from './pipeline-card';

type Grouped = Record<PipelineStage, PipelineLead[]>;

type Props = {
  grouped: Grouped;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (conversationId: string, toStage: PipelineStage) => Promise<void>;
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
      className={`flex h-full min-w-[260px] max-w-[280px] flex-col rounded-xl border ${ui.columnClass} ${
        isOver ? 'ring-2 ring-accent/40' : ''
      }`}
    >
      <div
        className={`flex items-center justify-between border-b px-3 py-2 ${ui.headerClass} rounded-t-xl border`}
      >
        <span className="text-sm font-semibold">
          {ui.emoji} {ui.label}
        </span>
        <span className="rounded-full bg-bg/50 px-2 py-0.5 text-xs tabular-nums">
          {leads.length}
        </span>
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
          <p className="py-6 text-center text-xs text-fg-muted">Sin leads</p>
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
    const { active, over } = event;
    if (!over) return;

    const conversationId = String(active.id);
    const toStage = String(over.id) as PipelineStage;
    if (!PIPELINE_STAGES.includes(toStage)) return;

    const fromStage = (active.data.current?.stage as PipelineStage) ?? null;
    if (fromStage === toStage) return;

    await onMove(conversationId, toStage);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e) => setActiveDragId(String(e.active.id))}
      onDragEnd={(e) => void handleDragEnd(e)}
      onDragCancel={() => setActiveDragId(null)}
    >
      <div className="flex h-full gap-3 overflow-x-auto pb-2">
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
          <div className="w-[260px] opacity-90">
            <PipelineCard lead={activeLead} selected={false} onSelect={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
