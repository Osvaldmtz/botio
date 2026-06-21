'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

type VariantResult = {
  name: string;
  label?: string;
  count: number;
  conversions: number;
  conversion_rate: number;
};

type ExperimentResults = {
  variants: VariantResult[];
  winner?: string;
  leading_variant?: string;
  p_value?: number;
  p_value_vs_baseline?: number;
  baseline_variant?: string;
  sample_ready: boolean;
  conversions_needed?: number;
  statistically_significant?: boolean;
};

export type ExperimentCardData = {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  status: string;
  winner_variant: string | null;
  created_at?: string;
  variants?: Record<string, {
    label?: string;
    first_message?: string;
    second_message?: string;
    system_prompt?: string;
    active?: boolean;
  }>;
  results?: ExperimentResults;
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Running',
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
    <div className="h-2 w-full overflow-hidden rounded bg-bg-subtle">
      <div
        className="h-full rounded bg-accent transition-all duration-150"
        style={{ width: `${Math.max(width, rate > 0 ? 6 : 0)}%` }}
      />
    </div>
  );
}

function variantLabel(
  key: string,
  variants?: Record<string, { label?: string }>,
  result?: VariantResult,
): string {
  return result?.label ?? variants?.[key]?.label ?? key;
}

function variantMessage(
  key: string,
  variants?: Record<string, { first_message?: string; system_prompt?: string }>,
): string | null {
  const variant = variants?.[key];
  if (!variant) return null;
  const text = variant.first_message?.trim() || variant.system_prompt?.trim();
  return text || null;
}

function VariantMessageText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) {
      setClamped(false);
      return;
    }
    setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  return (
    <div className="mt-2">
      <p
        ref={ref}
        className={cn(
          'whitespace-pre-wrap text-[13px] italic leading-relaxed',
          !expanded && 'line-clamp-4',
        )}
        style={{ color: 'var(--color-text-secondary, #71717A)' }}
      >
        {text}
      </p>
      {clamped && !expanded ? (
        <button
          type="button"
          className="mt-1 text-xs text-accent hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
        >
          ver más
        </button>
      ) : null}
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
  const leading = results?.leading_variant;

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
          <h3 className="text-sm font-semibold text-fg">📊 {experiment.name}</h3>
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
              Promover ganadora
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
        <div className="mt-4 space-y-3">
          {results.variants.map((v) => {
            const label = variantLabel(v.name, experiment.variants, v);
            const message = variantMessage(v.name, experiment.variants);
            const secondMessage = experiment.variants?.[v.name]?.second_message?.trim();
            const isInactive = experiment.variants?.[v.name]?.active === false;
            const isLeading = leading === v.name && !resolvedWinner;
            const isWinner = resolvedWinner === v.name;
            return (
              <div key={v.name} className="rounded border border-bg-border bg-bg-elevated p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-fg">
                    Variante {v.name} ({label})
                    {isInactive ? (
                      <span className="ml-2 text-xs font-normal text-fg-tertiary">— Retirada</span>
                    ) : null}
                    {isWinner || isLeading ? ' ★' : ''}
                    {isLeading ? (
                      <span className="ml-2 text-xs font-normal text-accent">— LEADING</span>
                    ) : null}
                  </span>
                  <span className="tabular-nums text-fg-muted">
                    Asignados: {v.count} | Convertidos: {v.conversions} ({v.conversion_rate}%)
                  </span>
                </div>
                {message ? <VariantMessageText text={message} /> : null}
                {secondMessage ? (
                  <div className="mt-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-fg-tertiary">
                      Turno 2
                    </p>
                    <VariantMessageText text={secondMessage} />
                  </div>
                ) : null}
                <ConversionBar rate={v.conversion_rate} maxRate={maxRate} />
              </div>
            );
          })}
        </div>
      ) : null}

      {results ? (
        <div className="mt-3 space-y-1 text-xs text-fg-tertiary">
          {results.p_value_vs_baseline !== undefined ? (
            <p>
              Significancia vs baseline ({results.baseline_variant ?? 'A'}):{' '}
              {results.statistically_significant ? '✓' : '○'} p=
              {results.p_value_vs_baseline}
              {results.statistically_significant && leading
                ? ` — Variante ${leading} mejor que ${results.baseline_variant ?? 'A'}`
                : ''}
            </p>
          ) : null}
          {results.p_value !== undefined ? (
            <p>p-value (top vs 2º): {results.p_value}</p>
          ) : null}
          {!results.sample_ready && results.conversions_needed !== undefined ? (
            <p>
              Necesita {results.conversions_needed} conversiones más por variante para confirmar
            </p>
          ) : results.sample_ready ? (
            <p>· muestra suficiente (≥30 conversiones/variante)</p>
          ) : (
            <p>· acumulando muestra</p>
          )}
        </div>
      ) : null}
    </article>
  );
}
