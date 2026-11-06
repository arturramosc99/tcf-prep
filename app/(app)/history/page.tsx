import { requirePage } from '@/lib/auth';
import Link from 'next/link';
import { Tip } from '@/components/Tip';
import { ScoreChart } from '@/components/ScoreChart';
import { sql } from '@/lib/db';
import { cecrFor, nclcFor } from '@/lib/scale';
import { fmtDate, fmtScore, scoredSessions, summary } from '@/lib/stats';

export const dynamic = 'force-dynamic';

type Row = { id: number; kind: string; mode: string; label: string | null; created_at: string; status: string; score: number | null; minutes: number | null; n: number };

export default async function History() {
  const { target, timezone } = await requirePage();
  const [list, rows] = await Promise.all([
    scoredSessions(),
    sql<Row>(`SELECT s.id, s.kind, s.mode, s.label, s.created_at, s.status, s.score, s.minutes,
      (SELECT count(*)::int FROM error_occurrences o WHERE o.session_id = s.id) AS n
      FROM sessions s WHERE s.status <> 'draft' ORDER BY s.created_at DESC`),
  ]);
  const ee = summary(list.filter((s) => s.kind === 'ee'));
  const eo = summary(list.filter((s) => s.kind === 'eo'));
  const delta = (s: typeof ee) => {
    const k = list.filter((x) => x.kind === s.last?.kind);
    return k.length >= 2 ? k.at(-1)!.score - k[0].score : null;
  };

  return (
    <div className="grid">
      <Tip id="history">Every corrected session, with your score over time. Open one to reread its correction.</Tip>
      <div className="grid two">
        {([['Écrite', ee], ['Orale', eo]] as const).map(([name, s]) => (
          <section key={name} className="card">
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div className="stack">
                <span className="label">{name} · average of the last 3</span>
                <span className="big">{fmtScore(s.avg3)}</span>
              </div>
              <table className="lines" style={{ width: 'auto', minWidth: 170 }}>
                <tbody>
                  <tr><td className="label">NCLC</td><td className="kicker">{s.avg3 != null ? nclcFor(s.avg3) : '—'}</td></tr>
                  <tr><td className="label">CEFR</td><td className="kicker">{s.avg3 != null ? cecrFor(s.avg3) : '—'}</td></tr>
                  <tr><td className="label">Since the 1st</td><td className="kicker">{delta(s) == null ? '—' : `${delta(s)! >= 0 ? '+' : ''}${delta(s)!.toFixed(1)}`}</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <section className="card stack">
        <div className="row between">
          <h2 className="title">Progress</h2>
          <span className="label">solid bar = Écrite · dashed = Orale · band = target</span>
        </div>
        <ScoreChart list={list} target={target} />
      </section>

      <section className="card soft">
        <table className="lines">
          <thead><tr><th>Date</th><th>Session</th><th>Score</th><th>Errors</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="kicker">{fmtDate(r.created_at, timezone)}</td>
                <td>{r.kind === 'ee' ? 'Écrite' : 'Orale'} · {r.label || (r.mode === 'simulado' ? 'Simulation' : 'Practice')}{r.minutes ? <span className="muted"> · {r.minutes} min</span> : null}</td>
                <td className="kicker">{r.status === 'done' ? (r.score != null ? `${r.score} · NCLC ${nclcFor(r.score)}` : '—') : r.status === 'correcting' ? 'correcting…' : 'error'}</td>
                <td className="kicker">{r.n}</td>
                <td style={{ textAlign: 'right' }}>{(r.mode === 'simulado' || r.kind === 'eo') && <Link className="btn small" href={`/session/${r.id}`}>Open</Link>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
