'use client';

import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ChartRange = 7 | 14 | 30 | 90;

type SourceStatus = { id: string; label: string; ok: boolean };

type Props = {
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  sources?: SourceStatus[];
  ranges?: ChartRange[];
  liveEnabled?: boolean;
  onLiveToggle?: () => void;
};

const RANGES: ChartRange[] = [7, 14, 30];

export function KpiToolbar({
  range,
  onRangeChange,
  onRefresh,
  refreshing,
  sources = [],
  ranges = RANGES,
  liveEnabled,
  onLiveToggle,
}: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-bg-border bg-bg-subtle/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-bg-border bg-bg p-1 shadow-sm">
          {ranges.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                range === r
                  ? 'bg-[#10B981] text-white shadow-sm'
                  : 'text-fg-muted hover:bg-bg-subtle hover:text-fg',
              )}
            >
              {r} días
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-xl border border-bg-border bg-bg px-3 py-1.5 text-xs font-semibold text-fg-muted shadow-sm transition hover:border-[#10B981]/40 hover:text-[#10B981] disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          Actualizar
        </button>
        {onLiveToggle ? (
          <button
            type="button"
            onClick={onLiveToggle}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition',
              liveEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-bg-border bg-bg text-fg-muted',
            )}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                liveEnabled ? 'animate-pulse bg-emerald-500' : 'bg-fg-tertiary',
              )}
            />
            En vivo {liveEnabled ? 'ON' : 'OFF'}
          </button>
        ) : null}
      </div>
      {sources.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {sources.map((s) => (
            <span
              key={s.id}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
                s.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', s.ok ? 'bg-emerald-500' : 'bg-rose-500')} />
              {s.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
