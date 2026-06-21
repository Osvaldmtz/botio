'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Series = {
  dataKey: string;
  name: string;
  color: string;
};

type Props = {
  data: Array<Record<string, string | number>>;
  xKey: string;
  series: Series[];
  height?: number;
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

export function KpiJarvisAreaChart({ data, xKey, series, height = 220 }: Props) {
  if (data.length === 0) return null;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.dataKey} id={`grad-${s.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
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
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }}
            iconType="circle"
            iconSize={8}
          />
          {series.map((s) => (
            <Area
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#grad-${s.dataKey})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: s.color }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
