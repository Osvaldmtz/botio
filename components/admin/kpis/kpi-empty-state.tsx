import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Props = {
  title?: string;
  description?: string;
  variant?: 'default' | 'jarvis';
};

export function KpiEmptyState({
  title = 'Sin datos',
  description = 'Sin datos — el cron sincroniza a las 6am UTC',
  variant = 'default',
}: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center',
        variant === 'jarvis'
          ? 'border-white/10 bg-slate-950/40'
          : 'border-bg-border bg-bg-subtle/40',
      )}
    >
      <BarChart3
        className={cn('mb-3 h-8 w-8', variant === 'jarvis' ? 'text-slate-500' : 'text-fg-tertiary')}
        strokeWidth={1.5}
      />
      <p className={cn('text-sm font-semibold', variant === 'jarvis' ? 'text-slate-300' : 'text-fg')}>
        {title}
      </p>
      <p
        className={cn(
          'mt-1 max-w-md text-sm',
          variant === 'jarvis' ? 'text-slate-500' : 'text-fg-muted',
        )}
      >
        {description}
      </p>
    </div>
  );
}
