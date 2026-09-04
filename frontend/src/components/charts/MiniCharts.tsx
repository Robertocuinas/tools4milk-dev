"use client";

type TrendPoint = {
  label: string;
  value: number;
};

export function SparkArea({
  data,
  color = "#35E479",
  height = 80,
}: {
  data: TrendPoint[];
  color?: string;
  height?: number;
}) {
  if (data.length < 2) return null;

  const width = 320;
  const padding = 8;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = data.map((point, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y =
      padding + (1 - (point.value - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `${padding},${height - padding} ${points.join(" ")} ${
    width - padding
  },${height - padding}`;

  return (
    <svg
      className="h-full w-full"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Grafico de tendencia"
    >
      <polygon points={area} fill={color} opacity="0.14" />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DonutStat({
  value,
  label,
  color = "#35E479",
}: {
  value: number;
  label: string;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * 34;
  const dash = (pct / 100) * circumference;

  return (
    <div className="relative grid place-items-center">
      <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden="true">
        <circle
          cx="46"
          cy="46"
          r="34"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="10"
        />
        <circle
          cx="46"
          cy="46"
          r="34"
          fill="none"
          stroke={color}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          strokeWidth="10"
          transform="rotate(-90 46 46)"
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-heading text-xl font-bold text-white">{pct}%</div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-tv-dim">
          {label}
        </div>
      </div>
    </div>
  );
}
