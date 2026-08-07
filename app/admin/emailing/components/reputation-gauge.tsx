/** Semicircular reputation gauge — pure SVG, no external libs */

type Props = {
  value: number; // 0–100
  label?: string;
};

function scoreColor(value: number): string {
  if (value < 40) return '#DC2626';
  if (value < 70) return '#D97706';
  return '#16A34A';
}

export function ReputationGauge({ value, label = 'Rate' }: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 70;
  const cx = 100;
  const cy = 96;
  // Semicircle from π (left) to 0 (right), clockwise via bottom
  const startAngle = Math.PI;
  const endAngle = 0;
  const angle = startAngle + (endAngle - startAngle) * (clamped / 100);

  const polar = (a: number, radius: number) => ({
    x: cx + radius * Math.cos(a),
    y: cy - radius * Math.sin(a),
  });

  // sweep=0 → counter-clockwise (through the top of the semicircle)
  const arcPath = (radius: number) => {
    const s = polar(startAngle, radius);
    const e = polar(endAngle, radius);
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 0 0 ${e.x} ${e.y}`;
  };

  const needle = polar(angle, r - 8);
  const color = scoreColor(clamped);
  const status =
    clamped >= 70 ? '¡Bueno!' : clamped >= 40 ? 'Regular' : 'Bajo';

  return (
    <div className="relative flex flex-col items-center">
      <span className="absolute right-2 top-0 text-ky-sm font-medium text-ky-positive">
        {status}
      </span>
      <svg viewBox="0 0 200 120" className="h-[140px] w-full max-w-[220px]">
        {/* Track */}
        <path
          d={arcPath(r)}
          fill="none"
          stroke="#E4E7EF"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={(() => {
            const s = polar(startAngle, r);
            const e = polar(angle, r);
            const large = clamped > 50 ? 1 : 0;
            return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
          })()}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Dashed outer guide */}
        <path
          d={arcPath(r + 14)}
          fill="none"
          stroke="#EEF0F6"
          strokeWidth="1.5"
          strokeDasharray="3 4"
        />
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needle.x}
          y2={needle.y}
          stroke="#1A1B2E"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="4" fill="#1A1B2E" />
        {/* Center value */}
        <text
          x={cx}
          y={cy - 18}
          textAnchor="middle"
          className="fill-ky-text-primary"
          style={{
            fontSize: '22px',
            fontWeight: 600,
            fontFamily: 'var(--font-ky-mono), monospace',
          }}
        >
          {clamped.toFixed(1)}%
        </text>
        <text
          x={cx}
          y={cy + 2}
          textAnchor="middle"
          style={{
            fontSize: '12px',
            fontWeight: 500,
            fill: '#5C6380',
          }}
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
