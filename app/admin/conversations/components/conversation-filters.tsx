'use client';

import { RefreshCw, Search } from 'lucide-react';
import type {
  ClosureFilter,
  ConversationStatusFilter,
  DateRangeFilter,
} from '../lib/conversation-queries';
import { CLOSURE_REASONS, CLOSURE_REASON_UI } from '@/lib/conversation-closure-constants';
import type { ChannelFilter } from '@/lib/channel-utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export type FilterState = {
  status: ConversationStatusFilter;
  closure: ClosureFilter;
  hotUnattended: boolean;
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
  { id: 'hot', label: 'Hot Leads' },
  { id: 'warm', label: 'Warm Leads' },
  { id: 'unanswered', label: 'Sin responder' },
  { id: 'handoff', label: 'En handoff' },
  { id: 'closed', label: 'Cerradas' },
];

const CHANNEL_CHIPS: Array<{ id: ChannelFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'webchat', label: 'Web' },
  { id: 'telegram', label: 'Telegram' },
];

const DATE_CHIPS: Array<{ id: DateRangeFilter; label: string }> = [
  { id: 'all', label: 'Todo' },
  { id: 'today', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: '7d', label: '7 días' },
  { id: 'custom', label: 'Custom' },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded px-2.5 py-1 text-[13px] font-medium transition-colors duration-150',
        active
          ? 'bg-bg-subtle text-fg'
          : 'text-fg-muted hover:bg-bg-subtle hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

export function ConversationFilters({
  filters,
  bots,
  onChange,
  onRefresh,
  refreshing,
  secondsSinceUpdate,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-tertiary" strokeWidth={1.5} />
          <Input
            type="search"
            placeholder="Buscar por teléfono, ciudad, intención..."
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-fg-tertiary">hace {secondsSinceUpdate}s</span>
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} strokeWidth={1.5} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-bg-border pb-3">
        {CHANNEL_CHIPS.map((chip) => (
          <Chip
            key={chip.id}
            active={filters.channel === chip.id}
            onClick={() => onChange({ channel: chip.id })}
          >
            {chip.label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {STATUS_CHIPS.map((chip) => (
          <Chip
            key={chip.id}
            active={filters.status === chip.id}
            onClick={() => onChange({ status: chip.id })}
          >
            {chip.label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 border-t border-bg-border pt-3">
        <Chip
          active={filters.closure === 'all'}
          onClick={() => onChange({ closure: 'all' })}
        >
          Todas
        </Chip>
        <Chip
          active={filters.closure === 'active'}
          onClick={() => onChange({ closure: 'active' })}
        >
          Activas
        </Chip>
        <Chip
          active={filters.closure === 'closed'}
          onClick={() => onChange({ closure: 'closed' })}
        >
          Cerradas
        </Chip>
        {CLOSURE_REASONS.map((reason) => {
          const ui = CLOSURE_REASON_UI[reason];
          return (
            <Chip
              key={reason}
              active={filters.closure === reason}
              onClick={() => onChange({ closure: reason })}
            >
              {ui.emoji} {ui.label}
            </Chip>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {DATE_CHIPS.map((chip) => (
          <Chip
            key={chip.id}
            active={filters.dateRange === chip.id}
            onClick={() => onChange({ dateRange: chip.id })}
          >
            {chip.label}
          </Chip>
        ))}

        {filters.dateRange === 'custom' ? (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => onChange({ from: e.target.value })}
              className="w-auto text-xs"
            />
            <span className="text-fg-tertiary">→</span>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => onChange({ to: e.target.value })}
              className="w-auto text-xs"
            />
          </div>
        ) : null}

        <select
          value={filters.botId}
          onChange={(e) => onChange({ botId: e.target.value })}
          className="rounded border border-bg-border bg-bg px-2.5 py-1.5 text-[13px] text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
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
