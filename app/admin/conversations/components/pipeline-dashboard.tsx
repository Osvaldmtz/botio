'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/pipeline';
import type { PipelineLead, PipelineStats } from '../lib/pipeline-queries';
import { AdminShell } from '@/components/admin/admin-shell';
import { PipelineStatsHeader } from './pipeline-stats';
import { PipelineFilters, type PipelineFilterState } from './pipeline-filters';
import { PipelineBoard } from './pipeline-board';
import { ConversationDetailPanel } from './conversation-detail';

type Bot = { id: string; name: string };
type Grouped = Record<PipelineStage, PipelineLead[]>;

type InitialData = {
  grouped: Grouped;
  stats: PipelineStats;
  bots: Bot[];
  fetchedAt: string;
};

const POLL_MS = 10_000;
const ADMIN_NAME_KEY = 'botio_handoff_name';

function buildQuery(filters: PipelineFilterState): string {
  const params = new URLSearchParams();
  if (filters.temperature) params.set('temperature', filters.temperature);
  if (filters.dateRange !== 'all') params.set('dateRange', filters.dateRange);
  if (filters.botId) params.set('botId', filters.botId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return params.toString();
}

export function PipelineDashboard({ initial }: { initial: InitialData }) {
  const [grouped, setGrouped] = useState(initial.grouped);
  const [stats, setStats] = useState(initial.stats);
  const [bots] = useState(initial.bots);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [filters, setFilters] = useState<PipelineFilterState>({
    temperature: '',
    dateRange: 'all',
    botId: '',
    from: '',
    to: '',
  });

  const queryString = useMemo(() => buildQuery(filters), [filters]);
  const totalLeads = PIPELINE_STAGES.reduce((n, s) => n + grouped[s].length, 0);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/pipeline?${queryString}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setGrouped(data.grouped);
      setStats(data.stats);
    } catch (error) {
      console.error('[pipeline] refresh failed', error);
    } finally {
      setRefreshing(false);
    }
  }, [queryString]);

  useEffect(() => {
    const t = setTimeout(() => void loadData(), 300);
    return () => clearTimeout(t);
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => void loadData(), POLL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  async function handleMove(conversationId: string, toStage: PipelineStage) {
    const movedBy =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(ADMIN_NAME_KEY) ?? 'Admin'
        : 'Admin';

    const res = await fetch(`/api/admin/conversations/${conversationId}/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_stage: toStage, moved_by: movedBy }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('[pipeline] move failed', body.error);
      return;
    }

    await loadData();
  }

  return (
    <AdminShell
      title="Pipeline de ventas"
      subtitle={`${totalLeads} leads · polling cada 10s`}
      className="flex min-h-0 flex-1 flex-col"
      aside={
        selectedId ? (
          <ConversationDetailPanel
            conversationId={selectedId}
            onClose={() => setSelectedId(null)}
            onHandoffChange={() => void loadData()}
          />
        ) : null
      }
    >
      <PipelineStatsHeader stats={stats} />
      <PipelineFilters
        filters={filters}
        bots={bots}
        onChange={(patch) => setFilters((p) => ({ ...p, ...patch }))}
        onRefresh={() => void loadData()}
        refreshing={refreshing}
      />
      <div className="min-h-[480px] flex-1">
        <PipelineBoard
          grouped={grouped}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={handleMove}
          activeDragId={activeDragId}
          setActiveDragId={setActiveDragId}
        />
      </div>
    </AdminShell>
  );
}
