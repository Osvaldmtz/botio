'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

const ACCENTS = {
  emerald: {
    ring: 'ring-emerald-500/30',
    glow: 'shadow-[0_0_24px_-4px_rgba(16,185,129,0.55)]',
    icon: 'text-emerald-400 bg-emerald-500/15',
    value: 'text-emerald-50',
    bar: 'bg-emerald-500',
  },
  cyan: {
    ring: 'ring-cyan-500/30',
    glow: 'shadow-[0_0_24px_-4px_rgba(34,211,238,0.5)]',
    icon: 'text-cyan-400 bg-cyan-500/15',
    value: 'text-cyan-50',
    bar: 'bg-cyan-400',
  },
  violet: {
    ring: 'ring-violet-500/30',
    glow: 'shadow-[0_0_24px_-4px_rgba(139,92,246,0.5)]',
    icon: 'text-violet-400 bg-violet-500/15',
    value: 'text-violet-50',
    bar: 'bg-violet-400',
  },
  amber: {
    ring: 'ring-amber-500/30',
    glow: 'shadow-[0_0_24px_-4px_rgba(245,158,11,0.45)]',
    icon: 'text-amber-400 bg-amber-500/15',
    value: 'text-amber-50',
    bar: 'bg-amber-400',
  },
  rose: {
    ring: 'ring-rose-500/30',
    glow: 'shadow-[0_0_24px_-4px_rgba(244,63,94,0.45)]',
    icon: 'text-rose-400 bg-rose-500/15',
    value: 'text-rose-50',
    bar: 'bg-rose-400',
  },
  blue: {
    ring: 'ring-blue-500/30',
    glow: 'shadow-[0_0_24px_-4px_rgba(59,130,246,0.45)]',
    icon: 'text-blue-400 bg-blue-500/15',
    value: 'text-blue-50',
    bar: 'bg-blue-400',
  },
} as const;

type Accent = keyof typeof ACCENTS;

type Props = {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: Accent;
  active?: boolean;
  onClick?: () => void;
  spark?: number[];
};

export function KpiHudMetric({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'emerald',
  active,
  onClick,
  spark,
}: Props) {
  const style = ACCENTS[accent];
  const maxSpark = spark?.length ? Math.max(...spark, 1) : 1;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group relative w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900/70 p-4 text-left backdrop-blur-md transition-all duration-200',
        'ring-1 ring-inset',
        style.ring,
        style.glow,
        active && 'border-emerald-400/50 ring-emerald-400/40',
        onClick && 'cursor-pointer hover:scale-[1.02] hover:border-white/20',
        !onClick && 'cursor-default',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn('rounded-lg p-2', style.icon)}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        {active ? (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
            foco
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums tracking-tight', style.value)}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
      {spark && spark.length > 1 ? (
        <div className="mt-3 flex h-8 items-end gap-0.5">
          {spark.map((v, i) => (
            <div
              key={i}
              className={cn('flex-1 rounded-sm opacity-80', style.bar)}
              style={{ height: `${Math.max(12, (v / maxSpark) * 100)}%` }}
            />
          ))}
        </div>
      ) : null}
    </button>
  );
}
