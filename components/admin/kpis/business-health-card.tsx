'use client';

import { cn } from '@/lib/cn';
import { getLtvCacHealth } from '@/lib/kpi/ltv-utils';

type Props = {
  ltvCacRatio: number | null | undefined;
  ltvAvg: number | null | undefined;
};

export function BusinessHealthCard({ ltvCacRatio, ltvAvg }: Props) {
  const health = getLtvCacHealth(ltvCacRatio);
  const ratio = ltvCacRatio ?? 0;
  const displayRatio = ratio > 0 ? `${ratio.toFixed(1)}x` : '—';

  return (
    <section
      className={cn(
        'rounded-2xl border p-5 shadow-sm',
        health.bgClass,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-fg-tertiary">
            Salud del negocio
          </p>
          <p className={cn('mt-1 text-2xl font-bold tabular-nums', health.colorClass)}>
            LTV:CAC {displayRatio}
          </p>
          <p className={cn('mt-1 text-sm font-semibold', health.colorClass)}>{health.label}</p>
        </div>
        {ltvAvg != null && ltvAvg > 0 ? (
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-fg-tertiary">
              LTV promedio
            </p>
            <p className="text-lg font-bold tabular-nums text-fg">
              ${ltvAvg.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD
            </p>
          </div>
        ) : null}
      </div>
      {ratio > 0 ? (
        <p className="mt-4 text-sm text-fg-muted">
          Cada $1 invertido en adquisición genera{' '}
          <span className="font-semibold text-fg">${ratio.toFixed(1)}</span> en ingresos totales
          (LTV).
        </p>
      ) : (
        <p className="mt-4 text-sm text-fg-muted">
          Ejecuta <code className="text-xs">/api/cron/kalyo-sync</code> para calcular LTV y ratio.
        </p>
      )}
    </section>
  );
}
