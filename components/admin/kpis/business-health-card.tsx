'use client';

import { cn } from '@/lib/cn';
import { formatLtvCacRatio, getLtvCacHealth } from '@/lib/kpi/ltv-utils';

type Props = {
  ltvCacRatio: number | null | undefined;
  ltvCacRatioAlltime?: number | null | undefined;
  ltvAvg: number | null | undefined;
  cacUsd?: number | null | undefined;
  cacUsdAlltime?: number | null | undefined;
  newSubscribers30d?: number | null | undefined;
};

export function BusinessHealthCard({
  ltvCacRatio,
  ltvCacRatioAlltime,
  ltvAvg,
  cacUsd,
  cacUsdAlltime,
  newSubscribers30d,
}: Props) {
  const health = getLtvCacHealth(ltvCacRatio);
  const ratio30d = formatLtvCacRatio(ltvCacRatio);
  const ratioAlltime = formatLtvCacRatio(ltvCacRatioAlltime);
  const hasPrimaryRatio = ltvCacRatio != null && ltvCacRatio > 0;

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
            LTV:CAC {ratio30d}
            <span className="ml-2 text-sm font-semibold text-fg-muted">(30d)</span>
          </p>
          <p className={cn('mt-1 text-sm font-semibold', health.colorClass)}>{health.label}</p>
          {ltvCacRatioAlltime != null && ltvCacRatioAlltime > 0 ? (
            <p className="mt-2 text-sm text-fg-muted">
              All-time:{' '}
              <span className="font-semibold tabular-nums text-fg">{ratioAlltime}</span>
            </p>
          ) : null}
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
      {hasPrimaryRatio ? (
        <div className="mt-4 space-y-1 text-sm text-fg-muted">
          <p>
            Cada $1 invertido en adquisición (30d) genera{' '}
            <span className="font-semibold text-fg">{ltvCacRatio!.toFixed(1)}</span> en ingresos
            totales (LTV).
          </p>
          {cacUsd != null && cacUsd > 0 ? (
            <p>
              CAC 30d:{' '}
              <span className="font-semibold text-fg">
                ${cacUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD
              </span>
              {newSubscribers30d != null && newSubscribers30d > 0 ? (
                <span> · {newSubscribers30d} clientes nuevos</span>
              ) : null}
              {cacUsdAlltime != null && cacUsdAlltime > 0 ? (
                <span>
                  {' '}
                  · CAC hist.: $
                  {cacUsdAlltime.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-fg-muted">
          Ejecuta <code className="text-xs">/api/cron/kalyo-sync</code> para calcular LTV y ratio.
        </p>
      )}
    </section>
  );
}
