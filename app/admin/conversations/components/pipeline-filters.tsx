'use client';

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

export function PipelineFilters({
  filters,
  bots,
  onChange,
  onRefresh,
  refreshing,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-bg-border bg-bg-elevated p-3">
      {(['', 'hot', 'warm', 'cold'] as const).map((temp) => (
        <button
          key={temp || 'all'}
          type="button"
          onClick={() => onChange({ temperature: temp })}
          className={`rounded-full border px-3 py-1 text-xs ${
            filters.temperature === temp
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-bg-border text-fg-muted'
          }`}
        >
          {temp === '' ? 'Todas temps' : temp}
        </button>
      ))}

      {(['all', '7d', '30d', 'custom'] as const).map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onChange({ dateRange: range })}
          className={`rounded-full border px-3 py-1 text-xs ${
            filters.dateRange === range
              ? 'border-electric/40 bg-electric/10 text-electric'
              : 'border-bg-border text-fg-muted'
          }`}
        >
          {range === 'all' ? 'Todo' : range === '7d' ? '7 días' : range === '30d' ? '30 días' : 'Custom'}
        </button>
      ))}

      {filters.dateRange === 'custom' ? (
        <>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => onChange({ from: e.target.value })}
            className="rounded border border-bg-border bg-bg px-2 py-1 text-xs"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => onChange({ to: e.target.value })}
            className="rounded border border-bg-border bg-bg px-2 py-1 text-xs"
          />
        </>
      ) : null}

      <select
        value={filters.botId}
        onChange={(e) => onChange({ botId: e.target.value })}
        className="rounded-lg border border-bg-border bg-bg px-2 py-1 text-xs"
      >
        <option value="">Todos los bots</option>
        {bots.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="ml-auto rounded-lg border border-bg-border px-3 py-1 text-xs text-fg-muted hover:text-fg disabled:opacity-50"
      >
        {refreshing ? '…' : '↻ Refresh'}
      </button>
    </div>
  );
}
