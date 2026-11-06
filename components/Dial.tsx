// Tick dial: filled ticks show the fraction left. `working` turns it into a loader: a lit tick travels round the
// dial (CSS .dial.working in globals.css), for waits on the AI. With "reduce motion" it stays still.
const SWEEP = 1.8; // seconds per turn, same as the dial-sweep animation

export function Dial({ fraction = 1, size = 260, children, label, working = false }: {
  fraction?: number; size?: number; children?: React.ReactNode; label?: string; working?: boolean;
}) {
  const n = 48, r = size / 2, f = Math.max(0, Math.min(1, fraction));
  const ticks = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const on = !working && i < Math.round(f * n);
    const r1 = r - 4, r2 = r - (on ? 20 : 14);
    const p = (v: number) => Math.round(v * 100) / 100; // avoids float differences between server and client
    // negative delay: every tick is already mid-cycle on the first frame, so the trail is there from the start
    const style = working ? { animationDelay: `${Math.round(((i / n) - 1) * SWEEP * 1000)}ms` } : undefined;
    return <line key={i} x1={p(r + r1 * Math.cos(a))} y1={p(r + r1 * Math.sin(a))} x2={p(r + r2 * Math.cos(a))} y2={p(r + r2 * Math.sin(a))}
      stroke="currentColor" strokeWidth={on || working ? 2.5 : 1.5} opacity={on ? 1 : 0.28} strokeLinecap="round" style={style} />;
  });
  return (
    <div className={`dial ${working ? 'working' : ''}`} style={{ position: 'relative', width: size, height: size, maxWidth: '100%' }}
      role={working ? 'progressbar' : 'timer'} aria-label={label} aria-busy={working || undefined}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" aria-hidden="true">
        {ticks}
        <circle cx={r} cy={r} r={r - 34} fill="none" stroke="currentColor" strokeWidth={1} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
    </div>
  );
}
