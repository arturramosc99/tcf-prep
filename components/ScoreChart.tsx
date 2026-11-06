import type { Target } from '@/lib/scale';
import type { Scored } from '@/lib/stats';

// Score out of 20 over time: thin bar per session, target NCLC band marked.
export function ScoreChart({ list, target: TARGET, height = 180 }: { list: Scored[]; target: Target; height?: number }) {
  if (!list.length) return <p className="muted">No corrected sessions yet.</p>;
  const W = Math.max(640, list.length * 40), pad = 26, H = height;
  const y = (v: number) => H - pad - (v / 20) * (H - pad - 8);
  const step = (W - pad) / Math.max(list.length, 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Score per session over time" style={{ overflow: 'visible' }}>
      <rect x={pad} y={y(TARGET.max + 1)} width={W - pad} height={y(TARGET.min) - y(TARGET.max + 1)} fill="currentColor" opacity={0.08} />
      {[0, 5, 10, 15, 20].map((v) => (
        <g key={v}>
          <line x1={pad} x2={W} y1={y(v)} y2={y(v)} stroke="currentColor" opacity={v === TARGET.min ? 0.6 : 0.15} strokeDasharray={v === TARGET.min ? '3 3' : undefined} />
          <text x={0} y={y(v) + 4} fontSize={10} fontFamily="var(--mono)" fill="currentColor" opacity={0.55}>{v}</text>
        </g>
      ))}
      <text x={W} y={y(TARGET.max + 1) - 4} fontSize={10} fontFamily="var(--mono)" fill="currentColor" textAnchor="end" opacity={0.7}>NCLC {TARGET.nclc}</text>
      {list.map((s, i) => {
        const x = pad + step * i + step / 2;
        return (
          <g key={s.id}>
            <line x1={x} x2={x} y1={y(0)} y2={y(s.score)} stroke="currentColor" strokeWidth={s.kind === 'eo' ? 1.5 : 3} strokeDasharray={s.kind === 'eo' ? '2 2' : undefined} />
            <text x={x} y={y(s.score) - 6} fontSize={10} fontFamily="var(--mono)" fill="currentColor" textAnchor="middle">{s.score}</text>
            <text x={x} y={H - 8} fontSize={10} fontFamily="var(--mono)" fill="currentColor" textAnchor="middle" opacity={0.6}>{s.kind.toUpperCase()}</text>
          </g>
        );
      })}
    </svg>
  );
}
