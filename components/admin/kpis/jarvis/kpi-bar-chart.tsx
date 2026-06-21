'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type BarSeries = {
  dataKey: string;
  name: string;
  color: string;
};

type Props = {
  data: Array<Record<string, string | number>>;
  xKey: string;
  bars: BarSeries[];
  height?: number;
  stacked?: boolean;
};

function JarvisTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-cyan-500/30 bg-slate-950/95 px-3 py-2 shadow-lg backdrop-blur-md">
      <p className="mb-1 text-[10px] uppercase tracking-wider text-cyan-400/80">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-xs text-slate-200" style={{ color: entry.color }}>
          {entry.name}: <span className="font-semibold tabular-nums">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export function KpiJarvisBarChart({ data, xKey, bars, height = 240, stacked = false }: Props) {
  if (data.length === 0) return null;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 6" stroke="rgba(148,163,184,0.12)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<JarvisTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} iconType="circle" iconSize={8} />
          {bars.map((b) => (
            <Bar
              key={b.dataKey}
              dataKey={b.dataKey}
              name={b.name}
              fill={b.color}
              stackId={stacked ? 'stack' : undefined}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
