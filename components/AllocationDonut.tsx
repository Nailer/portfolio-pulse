"use client";

const COLORS = [
  "#5eead4", "#818cf8", "#fb923c", "#f472b6", "#a3e635",
  "#facc15", "#60a5fa", "#c084fc", "#fca5a5", "#34d399",
];

export function AllocationDonut({
  slices,
}: {
  slices: Array<{ label: string; weight: number }>;
}) {
  const size = 180;
  const stroke = 26;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = slices.reduce<Array<(typeof slices)[number] & { color: string; length: number; offset: number }>>(
    (acc, s, i) => {
      const priorOffset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].length : 0;
      acc.push({ ...s, color: COLORS[i % COLORS.length], length: s.weight * circumference, offset: priorOffset });
      return acc;
    },
    [],
  );

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        {segments.map((s) => (
          <circle
            key={s.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${s.length} ${circumference - s.length}`}
            strokeDashoffset={-s.offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <ul className="flex flex-col gap-1.5 text-[13px]">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-fg-muted">{s.label}</span>
            <span className="font-mono text-fg">{(s.weight * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
