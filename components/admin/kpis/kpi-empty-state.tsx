import { BarChart3 } from 'lucide-react';

type Props = {
  title?: string;
  description?: string;
};

export function KpiEmptyState({
  title = 'Sin datos',
  description = 'Sin datos — el cron sincroniza a las 6am UTC',
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-bg-border bg-bg-subtle/40 px-6 py-12 text-center">
      <BarChart3 className="mb-3 h-8 w-8 text-fg-tertiary" strokeWidth={1.5} />
      <p className="text-sm font-semibold text-fg">{title}</p>
      <p className="mt-1 max-w-md text-sm text-fg-muted">{description}</p>
    </div>
  );
}
