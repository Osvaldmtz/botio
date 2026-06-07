'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

export type PipelineFilterState = {
  temperature: '' | 'hot' | 'warm' | 'cold';
  dateRange: 'all' | '7d' | '30d' | 'custom';
  botId: string;
  from: string;
  to: string;
};

type Bot = { id: string; name: string };

type Props = {
  filters: PipelineFilterState;
  bots: Bot[];
  onChange: (patch: Partial<PipelineFilterState>) => void;
  onRefresh: () => void;
  refreshing: boolean;
};

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
        active ? 'bg-bg-subtle text-fg' : 'text-fg-muted hover:bg-bg-subtle hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

export function PipelineFilters({
  filters,
  bots,
  onChange,
  onRefresh,
  refreshing,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-bg-border pb-4">
      {(['', 'hot', 'warm', 'cold'] as const).map((temp) => (
        <Chip
          key={temp || 'all'}
          active={filters.temperature === temp}
          onClick={() => onChange({ temperature: temp })}
        >
          {temp === '' ? 'Todas temps' : temp}
        </Chip>
      ))}

      {(['all', '7d', '30d', 'custom'] as const).map((range) => (
        <Chip
          key={range}
          active={filters.dateRange === range}
          onClick={() => onChange({ dateRange: range })}
        >
          {range === 'all'
            ? 'Todo'
            : range === '7d'
              ? '7 días'
              : range === '30d'
                ? '30 días'
                : 'Custom'}
        </Chip>
      ))}

      {filters.dateRange === 'custom' ? (
        <>
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => onChange({ from: e.target.value })}
            className="w-auto text-xs"
          />
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => onChange({ to: e.target.value })}
            className="w-auto text-xs"
          />
        </>
      ) : null}

      <select
        value={filters.botId}
        onChange={(e) => onChange({ botId: e.target.value })}
        className="rounded border border-bg-border bg-bg px-2.5 py-1.5 text-[13px] text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
      >
        <option value="">Todos los bots</option>
        {bots.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <Button variant="ghost" size="sm" className="ml-auto" onClick={onRefresh} disabled={refreshing}>
        <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} strokeWidth={1.5} />
        Refresh
      </Button>
    </div>
  );
}
