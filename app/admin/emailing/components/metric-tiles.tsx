import { ArrowDownRight, ArrowUpRight, ChevronRight } from 'lucide-react';
import { Badge } from './ui/badge';
import { Card } from './ui/card';

function MiniArc({ percent }: { percent: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const dash = (percent / 100) * c * 0.5;
  return (
    <svg viewBox="0 0 80 50" className="h-14 w-20">
      <path
        d="M 10 45 A 30 30 0 0 0 70 45"
        fill="none"
        stroke="#E4E7EF"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M 10 45 A 30 30 0 0 0 70 45"
        fill="none"
        stroke="#7C3AED"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
      />
      <text
        x="40"
        y="42"
        textAnchor="middle"
        style={{ fontSize: '11px', fontWeight: 600, fill: '#1A1B2E' }}
      >
        12k+
      </text>
    </svg>
  );
}

function MiniBars({ highlight }: { highlight: number }) {
  const bars = [22, 38, 28, 45, 32, 40, 36];
  return (
    <div className="relative flex h-14 items-end gap-1">
      {bars.map((h, i) => (
        <span
          key={i}
          className={`w-1.5 rounded-sm ${i === highlight ? 'bg-ky-chart-2' : 'bg-ky-border'}`}
          style={{ height: `${h}%` }}
        />
      ))}
      <span className="absolute -top-1 right-0 rounded-ky-tooltip bg-ky-nav px-1.5 py-0.5 font-ky-mono text-[10px] text-white">
        38.2%
      </span>
    </div>
  );
}

function MiniProgress() {
  return (
    <div className="w-20 space-y-1">
      <div className="h-2 overflow-hidden rounded-ky-badge bg-ky-border-subtle">
        <div className="h-full w-[72%] rounded-ky-badge bg-ky-chart-1" />
      </div>
      <p className="text-right font-ky-mono text-ky-caption text-ky-text-muted">
        1k+
      </p>
    </div>
  );
}

const METRICS = [
  {
    title: 'Mensajes Enviados',
    value: '12,430',
    delta: '+6.3%',
    positive: true,
    chart: <MiniArc percent={72} />,
  },
  {
    title: 'Tasa de Apertura',
    value: '38.2%',
    delta: '-2.7%',
    positive: false,
    chart: <MiniBars highlight={3} />,
  },
  {
    title: 'Nuevos Pacientes',
    value: '+1,248',
    delta: '+12%',
    positive: true,
    chart: <MiniProgress />,
  },
] as const;

export function MetricTiles() {
  return (
    <div className="grid gap-ky-section sm:grid-cols-3">
      {METRICS.map((m) => (
        <Card key={m.title} className="relative">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-ky-body font-medium text-ky-text-secondary">
              {m.title}
            </p>
            <ChevronRight className="h-4 w-4 text-ky-text-muted" />
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-ky-mono text-ky-display text-ky-text-primary">
                {m.value}
              </p>
              <Badge
                tone={m.positive ? 'positive' : 'negative'}
                className="mt-2"
              >
                {m.positive ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {m.delta}
              </Badge>
            </div>
            {m.chart}
          </div>
        </Card>
      ))}
    </div>
  );
}
