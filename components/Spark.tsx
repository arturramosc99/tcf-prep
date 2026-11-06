// Thin bar per session: height = occurrences in that session.
export function Spark({ values, height = 28 }: { values: number[]; height?: number }) {
  const max = Math.max(1, ...values), w = 6;
  return (
    <svg width={values.length * w} height={height} aria-hidden="true" style={{ display: 'block' }}>
      {values.map((v, i) => (
        <line key={i} x1={i * w + 2} x2={i * w + 2} y1={height} y2={v ? height - (v / max) * (height - 2) : height - 1}
          stroke="currentColor" strokeWidth={v ? 2 : 1} opacity={v ? 1 : 0.25} />
      ))}
    </svg>
  );
}
