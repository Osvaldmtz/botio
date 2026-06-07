'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

type VariantResult = {
  name: string;
  count: number;
  conversions: number;
  conversion_rate: number;
};

type ExperimentResults = {
  variants: VariantResult[];
  winner?: string;
  p_value?: number;
  sample_ready: boolean;
};

export type ExperimentCardData = {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  status: string;
  winner_variant: string | null;
  results?: ExperimentResults;
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  paused: 'Pausado',
  completed: 'Completado',
  archived: 'Archivado',
};

function statusTone(status: string): 'primary' | 'warning' | 'gray' {
  if (status === 'active') return 'primary';
  if (status === 'paused') return 'warning';
  return 'gray';
}

function ConversionBar({ rate, maxRate }: { rate: number; maxRate: number }) {
  const width = maxRate > 0 ? Math.round((rate / maxRate) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-bg-subtle">
      <div
        className="h-full rounded bg-accent transition-all duration-150"
        style={{ width: `${Math.max(width, rate > 0 ? 4 : 0)}%` }}
      />
    </div>
  );
}

type Props = {
  experiment: ExperimentCardData;
  selected: boolean;
  winner?: string | null;
  actionLoading: string | null;
  onSelect: () => void;
  onAction: (action: string) => void;
};

export function ExperimentCard({
  experiment,
  selected,
  winner,
  actionLoading,
  onSelect,
  onAction,
}: Props) {
  const results = experiment.results;
  const maxRate = Math.max(...(results?.variants ?? []).map((v) => v.conversion_rate), 1);
  const resolvedWinner = experiment.winner_variant ?? winner ?? results?.winner;

  return (
    <article
      className={cn(
        'cursor-pointer rounded-card border bg-bg p-4 transition-colors duration-150',
        selected
          ? 'border-accent bg-accent-muted/20'
          : 'border-bg-border hover:border-bg-border-hover',
      )}
      onClick={onSelect}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-fg">{experiment.name}</h3>
          {experiment.description ? (
            <p className="mt-1 text-sm text-fg-muted">{experiment.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={statusTone(experiment.status)}>
              {STATUS_LABELS[experiment.status] ?? experiment.status}
            </Badge>
            <Badge tone="gray">{experiment.scope}</Badge>
            {resolvedWinner ? (
              <Badge tone="primary">Ganador: {resolvedWinner}</Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          {experiment.status === 'active' ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={actionLoading === `${experiment.id}-pause`}
              onClick={() => onAction('pause')}
            >
              Pausar
            </Button>
          ) : null}
          {experiment.status === 'paused' ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={actionLoading === `${experiment.id}-resume`}
              onClick={() => onAction('resume')}
            >
              Reanudar
            </Button>
          ) : null}
          {resolvedWinner && experiment.status !== 'completed' ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={actionLoading === `${experiment.id}-promote_winner`}
              onClick={() => onAction('promote_winner')}
            >
              Promover
            </Button>
          ) : null}
          {experiment.status === 'active' || experiment.status === 'paused' ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={actionLoading === `${experiment.id}-stop`}
              onClick={() => onAction('stop')}
            >
              Detener
            </Button>
          ) : null}
        </div>
      </div>

      {results?.variants?.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {results.variants.map((v) => (
            <div key={v.name} className="rounded border border-bg-border bg-bg-elevated p-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-fg">
                  Variante {v.name}
                  {resolvedWinner === v.name ? ' ★' : ''}
                </span>
                <span className="tabular-nums text-fg-muted">
                  {v.conversions}/{v.count} ({v.conversion_rate}%)
                </span>
              </div>
              <ConversionBar rate={v.conversion_rate} maxRate={maxRate} />
            </div>
          ))}
        </div>
      ) : null}

      {results?.p_value !== undefined ? (
        <p className="mt-3 text-xs text-fg-tertiary">
          p-value: {results.p_value}
          {results.sample_ready ? ' · muestra suficiente' : ' · acumulando muestra'}
        </p>
      ) : null}
    </article>
  );
}
