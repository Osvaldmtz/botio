import { cn } from '@/lib/cn';

type Props = {
  label: string;
  value: string;
  hint?: string;
  className?: string;
};

export function KpiMetricCard({ label, value, hint, className }: Props) {
  return (
    <div
      className={cn(
        'rounded-card border border-bg-border bg-bg p-4 transition-colors duration-150',
        className,
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-fg-tertiary">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-fg">{value}</p>
      {hint ? <p className="mt-1 text-xs text-fg-muted">{hint}</p> : null}
    </div>
  );
}
