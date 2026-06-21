'use client';

import { RefreshCw, Radio } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ChartRange = 7 | 14 | 30;

type SourceStatus = {
  id: string;
  label: string;
  ok: boolean;
};

type Props = {
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  sources: SourceStatus[];
  liveEnabled?: boolean;
  onLiveToggle?: () => void;
};

const RANGES: ChartRange[] = [7, 14, 30];

export function KpiControlBar({
  range,
  onRangeChange,
  onRefresh,
  refreshing,
  sources,
  liveEnabled = true,
  onLiveToggle,
}: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
          Jarvis · Command
        </span>
        <div className="flex rounded-lg border border-white/10 bg-slate-950/80 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                range === r
                  ? 'bg-emerald-500/20 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                  : 'text-slate-400 hover:text-slate-200',
              )}
            >
              {r}d
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-emerald-500/30 hover:text-emerald-200 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          Sync
        </button>
        {onLiveToggle ? (
          <button
            type="button"
            onClick={onLiveToggle}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
              liveEnabled
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-white/10 bg-slate-950/80 text-slate-400',
            )}
          >
            <Radio className="h-3.5 w-3.5" />
            Live {liveEnabled ? 'ON' : 'OFF'}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {sources.map((s) => (
          <span
            key={s.id}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide',
              s.ok
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/25 bg-rose-500/10 text-rose-300',
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                s.ok ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-rose-400',
              )}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
