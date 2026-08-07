'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Expand, MoreHorizontal } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';

const DATA = [
  { day: '7 Feb', sesiones: 18200, asistencia: 9800, cancelaciones: 2400 },
  { day: '8 Feb', sesiones: 22100, asistencia: 11200, cancelaciones: 2100 },
  { day: '9 Feb', sesiones: 19800, asistencia: 10500, cancelaciones: 2800 },
  { day: '10 Feb', sesiones: 25400, asistencia: 13400, cancelaciones: 1900 },
  { day: '11 Feb', sesiones: 28900, asistencia: 15200, cancelaciones: 2200 },
  { day: '12 Feb', sesiones: 31200, asistencia: 16800, cancelaciones: 1700 },
  { day: '13 Feb', sesiones: 27600, asistencia: 14100, cancelaciones: 2500 },
];

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-ky-tooltip bg-ky-nav px-3 py-2 text-white shadow-ky-modal">
      <p className="mb-1 font-ky-mono text-ky-caption text-white/70">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-ky-sm" style={{ color: p.color }}>
          {p.name}:{' '}
          <span className="font-ky-mono text-white">
            {p.value.toLocaleString('es-CO')}
          </span>
        </p>
      ))}
    </div>
  );
}

export function PerformanceChart() {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-ky-h2">Rendimiento de Campañas</CardTitle>
          <CardDescription>
            Sesiones, asistencia y cancelaciones de los últimos 7 días.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden items-center gap-3 text-ky-caption sm:flex">
            <span className="inline-flex items-center gap-1.5 text-ky-text-secondary">
              <span className="h-2 w-2 rounded-full bg-ky-chart-1" /> Sesiones
            </span>
            <span className="inline-flex items-center gap-1.5 text-ky-text-secondary">
              <span className="h-2 w-2 rounded-full bg-ky-chart-2" /> Asistencia
            </span>
            <span className="inline-flex items-center gap-1.5 text-ky-text-secondary">
              <span className="h-2 w-2 rounded-full bg-ky-chart-3" /> Cancelaciones
            </span>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-ky-badge border border-ky-border px-3 py-1.5 font-ky-mono text-ky-caption text-ky-text-secondary hover:bg-ky-surface-1"
          >
            Últimos 07 días
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="rounded-ky-btn p-1.5 text-ky-text-muted hover:bg-ky-surface-1"
            aria-label="Expandir"
          >
            <Expand className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={DATA} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="kyArea1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#EEF0F6"
              strokeDasharray="0"
            />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#9299B0', fontSize: 12 }}
            />
            <YAxis
              orientation="right"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#9299B0', fontSize: 12 }}
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="sesiones"
              name="Sesiones"
              stroke="#7C3AED"
              strokeWidth={2}
              fill="url(#kyArea1)"
            />
            <Area
              type="monotone"
              dataKey="asistencia"
              name="Asistencia"
              stroke="#F97316"
              strokeWidth={2}
              fill="transparent"
            />
            <Area
              type="monotone"
              dataKey="cancelaciones"
              name="Cancelaciones"
              stroke="#94A3B8"
              strokeWidth={2}
              fill="transparent"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
