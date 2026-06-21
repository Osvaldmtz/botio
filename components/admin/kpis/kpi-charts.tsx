'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type LineSeries = {
  dataKey: string;
  name: string;
  color?: string;
};

type KpiLineChartProps = {
  data: Array<Record<string, string | number>>;
  xKey: string;
  series: LineSeries[];
  height?: number;
};

type KpiBarChartProps = {
  data: Array<Record<string, string | number>>;
  xKey: string;
  bars: LineSeries[];
  height?: number;
  stacked?: boolean;
};

const DEFAULT_COLORS = ['#10B981', '#6366F1', '#F59E0B', '#EF4444'];

export function KpiLineChart({ data, xKey, series, height = 240 }: KpiLineChartProps) {
  if (data.length === 0) return null;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
          <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" width={48} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s, i) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KpiBarChart({ data, xKey, bars, height = 240, stacked = false }: KpiBarChartProps) {
  if (data.length === 0) return null;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
          <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" width={48} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {bars.map((b, i) => (
            <Bar
              key={b.dataKey}
              dataKey={b.dataKey}
              name={b.name}
              fill={b.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
              stackId={stacked ? 'stack' : undefined}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KpiDualBarChart({
  data,
  xKey,
  leftKey,
  rightKey,
  leftLabel,
  rightLabel,
  height = 240,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  leftKey: string;
  rightKey: string;
  leftLabel: string;
  rightLabel: string;
  height?: number;
}) {
  return (
    <KpiBarChart
      data={data}
      xKey={xKey}
      height={height}
      bars={[
        { dataKey: leftKey, name: leftLabel, color: '#10B981' },
        { dataKey: rightKey, name: rightLabel, color: '#6366F1' },
      ]}
    />
  );
}
