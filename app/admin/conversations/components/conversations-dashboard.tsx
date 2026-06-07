'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type {
  ConversationSummary,
  DashboardStats,
} from '../lib/conversation-queries';
import { ConversationFilters, type FilterState } from './conversation-filters';
import { ConversationStats } from './conversation-stats';
import { ConversationList } from './conversation-list';
import { ConversationDetailPanel } from './conversation-detail';

type Bot = { id: string; name: string };

type InitialData = {
  conversations: ConversationSummary[];
  stats: DashboardStats;
  bots: Bot[];
  fetchedAt: string;
};

type Props = {
  initial: InitialData;
};

const POLL_INTERVAL_MS = 10_000;

function buildQuery(filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.dateRange !== 'all') params.set('dateRange', filters.dateRange);
  if (filters.botId) params.set('botId', filters.botId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return params.toString();
}

export function ConversationsDashboard({ initial }: Props) {
  const [conversations, setConversations] = useState(initial.conversations);
  const [stats, setStats] = useState(initial.stats);
  const [bots] = useState(initial.bots);
  const [fetchedAt, setFetchedAt] = useState(initial.fetchedAt);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);

  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    search: '',
    dateRange: 'all',
    botId: '',
    from: '',
    to: '',
  });

  const queryString = useMemo(() => buildQuery(filters), [filters]);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/conversations?${queryString}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConversations(data.conversations);
      setStats(data.stats);
      setFetchedAt(data.fetchedAt);
    } catch (error) {
      console.error('[dashboard] refresh failed', error);
    } finally {
      setRefreshing(false);
    }
  }, [queryString]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadData();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    const tick = setInterval(() => {
      const seconds = Math.floor((Date.now() - new Date(fetchedAt).getTime()) / 1000);
      setSecondsSinceUpdate(Math.max(0, seconds));
    }, 1000);
    return () => clearInterval(tick);
  }, [fetchedAt]);

  function handleFilterChange(patch: Partial<FilterState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-bg-border px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-fg">Conversaciones</h1>
              <p className="text-sm text-fg-muted">
                {conversations.length} resultado(s) · polling cada 10s
              </p>
            </div>
            <Link
              href="/admin"
              className="shrink-0 rounded-lg border border-bg-border px-3 py-2 text-sm text-fg-muted hover:text-fg"
            >
              ← Admin
            </Link>
          </div>
        </header>

        <div className="space-y-4 p-4 sm:p-6">
          <ConversationStats stats={stats} />
          <ConversationFilters
            filters={filters}
            bots={bots}
            onChange={handleFilterChange}
            onRefresh={() => void loadData()}
            refreshing={refreshing}
            secondsSinceUpdate={secondsSinceUpdate}
          />
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </div>

      {selectedId ? (
        <ConversationDetailPanel
          conversationId={selectedId}
          onClose={() => setSelectedId(null)}
          onHandoffChange={() => void loadData()}
        />
      ) : null}
    </div>
  );
}
