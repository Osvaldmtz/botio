'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ConversationSummary,
  DashboardStats,
} from '../lib/conversation-queries';
import { sortConversationsWithHotPriority } from '../lib/conversation-sort';
import { AdminShell } from '@/components/admin/admin-shell';
import { ConversationFilters, type FilterState } from './conversation-filters';
import { ConversationStats } from './conversation-stats';
import { ConversationList } from './conversation-list';
import { ConversationDetailPanel } from './conversation-detail';
import { HotLeadsAlertBanner } from './hot-leads-alert-banner';

type Bot = { id: string; name: string };

type InitialData = {
  conversations: ConversationSummary[];
  stats: DashboardStats;
  bots: Bot[];
  fetchedAt: string;
};

const POLL_INTERVAL_MS = 10_000;

function buildQuery(filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.closure !== 'all') params.set('closure', filters.closure);
  if (filters.hotUnattended) params.set('hotUnattended', 'true');
  if (filters.channel !== 'all') params.set('channel', filters.channel);
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.dateRange !== 'all') params.set('dateRange', filters.dateRange);
  if (filters.botId) params.set('botId', filters.botId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return params.toString();
}

export function ConversationsDashboard({ initial }: { initial: InitialData }) {
  const [conversations, setConversations] = useState(
    sortConversationsWithHotPriority(initial.conversations),
  );
  const [stats, setStats] = useState(initial.stats);
  const [bots] = useState(initial.bots);
  const [fetchedAt, setFetchedAt] = useState(initial.fetchedAt);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);

  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    closure: 'all',
    hotUnattended: false,
    channel: 'all',
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
      setConversations(sortConversationsWithHotPriority(data.conversations));
      setStats(data.stats);
      setFetchedAt(data.fetchedAt);
    } catch (error) {
      console.error('[dashboard] refresh failed', error);
    } finally {
      setRefreshing(false);
    }
  }, [queryString]);

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => void loadData(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    const tick = setInterval(() => {
      const seconds = Math.floor((Date.now() - new Date(fetchedAt).getTime()) / 1000);
      setSecondsSinceUpdate(Math.max(0, seconds));
    }, 1000);
    return () => clearInterval(tick);
  }, [fetchedAt]);

  return (
    <AdminShell
      title="Conversaciones"
      subtitle={`${conversations.length} resultado(s) · polling cada 10s`}
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
      <HotLeadsAlertBanner
        count={stats.unattendedHot24h}
        onFilter={() =>
          setFilters((prev) => ({
            ...prev,
            hotUnattended: true,
            status: 'all',
            closure: 'all',
          }))
        }
      />
      <ConversationStats stats={stats} />
      <ConversationFilters
        filters={filters}
        bots={bots}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onRefresh={() => void loadData()}
        refreshing={refreshing}
        secondsSinceUpdate={secondsSinceUpdate}
      />
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </AdminShell>
  );
}
