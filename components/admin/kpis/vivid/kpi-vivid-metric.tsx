'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { VIVID, type VividAccent } from './palette';

type Props = {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: VividAccent;
  spark?: number[];
  compact?: boolean;
  progress?: { current: number; goal: number };
};

export function KpiVividMetric({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'emerald',
  spark,
  compact,
  progress,
}: Props) {
  const c = VIVID[accent];
  const maxSpark = spark?.length ? Math.max(...spark, 1) : 1;
  const progressPct =
    progress && progress.goal > 0
      ? Math.round((progress.current / progress.goal) * 100)
      : null;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl text-white shadow-sm',
        compact ? 'p-3' : 'p-4',
      )}
      style={{ background: `linear-gradient(135deg, ${c.from} 0%, ${c.to} 100%)` }}
    >
      <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/15 blur-xl" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'font-medium uppercase tracking-wide text-white/80',
              compact ? 'text-[10px]' : 'text-[11px]',
            )}
          >
            {label}
          </p>
          <p
            className={cn(
              'mt-1 font-bold tabular-nums tracking-tight',
              compact ? 'text-xl' : 'text-2xl',
            )}
          >
            {value}
          </p>
          {hint ? <p className="mt-0.5 text-xs text-white/70">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className="rounded-xl bg-white/20 p-2 backdrop-blur-sm">
            <Icon className="h-4 w-4" strokeWidth={2} />
          </div>
        ) : null}
      </div>
      {progress && progressPct != null ? (
        <div className="relative mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white/85 transition-all"
              style={{ width: `${Math.min(100, progressPct)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-white/75">
            {progress.current}/{progress.goal} — {progressPct}% de la meta
          </p>
        </div>
      ) : null}
      {spark && spark.length > 1 ? (
        <div className="relative mt-3 flex h-7 items-end gap-0.5">
          {spark.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-white/35"
              style={{ height: `${Math.max(15, (v / maxSpark) * 100)}%` }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function KpiVividMetricLight({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'emerald',
}: Props) {
  const c = VIVID[accent];
  return (
    <div
      className="rounded-xl border border-bg-border bg-bg p-4 shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: c.from }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-fg-tertiary">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-fg">{value}</p>
          {hint ? <p className="mt-0.5 text-xs text-fg-muted">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className="rounded-lg p-2" style={{ backgroundColor: c.light, color: c.from }}>
            <Icon className="h-4 w-4" strokeWidth={2} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
