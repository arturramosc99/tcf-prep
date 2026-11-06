// Thin progress ring.
export function Ring({ value, max, size = 64, children }: { value: number; max: number; size?: number; children?: React.ReactNode }) {
  const r = size / 2 - 3, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" opacity={0.2} strokeWidth={2} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={3} strokeDasharray={`${f * c} ${c}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'var(--mono)', fontSize: 13 }}>{children}</div>
    </div>
  );
}
