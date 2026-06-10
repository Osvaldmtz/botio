'use client';

import type { AmbassadorMetrics as Metrics } from '@/lib/ambassador-admin-queries';

type Props = {
  metrics: Metrics | null;
};

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-bg-border bg-bg p-4">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-fg">{value}</p>
      {hint ? <p className="mt-1 text-xs text-fg-tertiary">{hint}</p> : null}
    </div>
  );
}

export function AmbassadorMetrics({ metrics }: Props) {
  if (!metrics) {
    return <p className="text-sm text-fg-muted">Cargando métricas…</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card label="Total leads (30d)" value={String(metrics.total_leads)} />
      <Card label="Registrados Luma" value={String(metrics.luma_registered)} />
      <Card
        label="Tasa registro"
        value={`${metrics.registration_rate}%`}
        hint={`${metrics.link_sent} recibieron link`}
      />
      <Card label="Asistieron webinar" value={String(metrics.attended)} />
    </div>
  );
}
