'use client';

import type {
  ConversationStatusFilter,
  DateRangeFilter,
} from '../lib/conversation-queries';
import type { ChannelFilter } from '@/lib/channel-utils';

export type FilterState = {
  status: ConversationStatusFilter;
  channel: ChannelFilter;
  search: string;
  dateRange: DateRangeFilter;
  botId: string;
  from: string;
  to: string;
};

type Bot = { id: string; name: string };

type Props = {
  filters: FilterState;
  bots: Bot[];
  onChange: (patch: Partial<FilterState>) => void;
  onRefresh: () => void;
  refreshing: boolean;
  secondsSinceUpdate: number;
};

const STATUS_CHIPS: Array<{ id: ConversationStatusFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'hot', label: 'Hot Leads 🔥' },
  { id: 'warm', label: 'Warm Leads 🟡' },
  { id: 'unanswered', label: 'Sin responder' },
  { id: 'handoff', label: 'En handoff 🙋' },
  { id: 'closed', label: 'Cerradas' },
];

const CHANNEL_CHIPS: Array<{ id: ChannelFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'whatsapp', label: '📱 WhatsApp' },
  { id: 'webchat', label: '💬 Web' },
  { id: 'telegram', label: '📨 Telegram' },
];

const DATE_CHIPS: Array<{ id: DateRangeFilter; label: string }> = [
  { id: 'all', label: 'Todo' },
  { id: 'today', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: '7d', label: '7 días' },
  { id: 'custom', label: 'Custom' },
];

export function ConversationFilters({
  filters,
  bots,
  onChange,
  onRefresh,
  refreshing,
  secondsSinceUpdate,
}: Props) {
  return (
    <div className="space-y-4 rounded-xl border border-bg-border bg-bg-elevated p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          placeholder="Buscar por teléfono, ciudad, intención..."
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          className="w-full rounded-lg border border-bg-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-accent/50 focus:outline-none sm:max-w-md"
        />

        <div className="flex items-center gap-2">
          <span className="text-xs text-fg-muted">
            Actualizado hace {secondsSinceUpdate}s
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-lg border border-bg-border px-3 py-1.5 text-xs text-fg-muted transition-colors hover:border-accent/40 hover:text-fg disabled:opacity-50"
          >
            {refreshing ? 'Actualizando…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {CHANNEL_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => onChange({ channel: chip.id })}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filters.channel === chip.id
                ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                : 'border-bg-border text-fg-muted hover:text-fg'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => onChange({ status: chip.id })}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filters.status === chip.id
                ? 'border-accent/50 bg-accent/10 text-accent'
                : 'border-bg-border text-fg-muted hover:text-fg'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {DATE_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => onChange({ dateRange: chip.id })}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              filters.dateRange === chip.id
                ? 'border-electric/50 bg-electric/10 text-electric'
                : 'border-bg-border text-fg-muted hover:text-fg'
            }`}
          >
            {chip.label}
          </button>
        ))}

        {filters.dateRange === 'custom' ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={filters.from}
              onChange={(e) => onChange({ from: e.target.value })}
              className="rounded-lg border border-bg-border bg-bg px-2 py-1 text-xs text-fg"
            />
            <span className="text-xs text-fg-muted">→</span>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => onChange({ to: e.target.value })}
              className="rounded-lg border border-bg-border bg-bg px-2 py-1 text-xs text-fg"
            />
          </div>
        ) : null}

        <select
          value={filters.botId}
          onChange={(e) => onChange({ botId: e.target.value })}
          className="rounded-lg border border-bg-border bg-bg px-3 py-1 text-xs text-fg"
        >
          <option value="">Todos los bots</option>
          {bots.map((bot) => (
            <option key={bot.id} value={bot.id}>
              {bot.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
