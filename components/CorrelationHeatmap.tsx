"use client";

function cellColor(v: number): string {
  // v in [-1, 1]. Positive -> teal, negative -> rose, 0 -> neutral.
  const clamped = Math.max(-1, Math.min(1, v));
  if (clamped >= 0) {
    const a = clamped;
    return `rgba(94, 234, 212, ${0.12 + a * 0.65})`;
  }
  const a = -clamped;
  return `rgba(251, 113, 133, ${0.12 + a * 0.65})`;
}

export function CorrelationHeatmap({
  symbols,
  matrix,
}: {
  symbols: string[];
  matrix: number[][];
}) {
  if (symbols.length < 2) {
    return (
      <p className="text-[12px] text-fg-subtle">
        Add at least two holdings to see how their recent momentum compares.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th className="w-14" />
            {symbols.map((s) => (
              <th key={s} className="text-[10px] font-mono text-fg-subtle font-normal px-1 pb-1">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {symbols.map((rowSym, i) => (
            <tr key={rowSym}>
              <td className="text-[10px] font-mono text-fg-subtle pr-2 text-right">{rowSym}</td>
              {symbols.map((colSym, j) => (
                <td key={colSym}>
                  <div
                    title={`${rowSym} vs ${colSym}: ${matrix[i][j].toFixed(2)}`}
                    className="w-10 h-10 rounded-md flex items-center justify-center text-[10px] font-mono text-fg"
                    style={{ background: i === j ? "var(--ring-track)" : cellColor(matrix[i][j]) }}
                  >
                    {i === j ? "—" : matrix[i][j].toFixed(2)}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
