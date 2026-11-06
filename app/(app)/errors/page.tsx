import { requirePage } from '@/lib/auth';
import { Spark } from '@/components/Spark';
import { StatusToggle } from '@/components/StatusToggle';
import Link from 'next/link';
import { Tip } from '@/components/Tip';
import { cardStats } from '@/lib/cards';
import { patternViews } from '@/lib/errors';
import { ORDER, STATUS_HELP, STATUS_LABEL } from '@/lib/status';
import { fmtDate } from '@/lib/stats';

export const dynamic = 'force-dynamic';

const TONE = { critique: 'bad', actif: 'warn', observation: 'warn', controle: 'good', resolu: 'good' } as const;

export default async function Errors() {
  const { timezone } = await requirePage();
  const [views, cards] = await Promise.all([patternViews(), cardStats()]);
  const count = (s: string) => views.filter((v) => v.status === s).length;
  return (
    <div className="grid">
      <Tip id="errors">Each pattern groups the same kind of mistake across your sessions. Open one to see every occurrence, then practise it with its flashcards.</Tip>
      <section className="card">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div className="row" style={{ gap: 28 }}>
            {ORDER.map((s) => (
              <div key={s} className="stack" title={STATUS_HELP[s]}>
                <span className="label">{STATUS_LABEL[s]}</span>
                <span className={`mid ${TONE[s]}`}>{String(count(s)).padStart(2, '0')}</span>
              </div>
            ))}
          </div>
          <a className="btn small" href="/api/export">Export .md</a>
        </div>
        <p className="label" style={{ marginTop: 16 }}>
          Status is computed over your corrected sessions: critical = 2+ in the last 3 · active = appeared in the last one ·
          under control = frequent before and absent from the last 3 · resolved = absent from the last 6. Absence can mean avoidance — check the examples.
        </p>
      </section>

      {views.map((v) => (
        <details key={v.id} id={v.slug} className="card soft" open={v.status === 'critique'}>
          <summary style={{ listStyle: 'none', cursor: 'pointer' }}>
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div className="stack" style={{ flex: '1 1 240px', minWidth: 0 }}>
                <span className="label">{v.categorie}</span>
                <h2 className="title" style={{ fontSize: 20 }}>{v.titre}</h2>
              </div>
              <div className="row" style={{ gap: 20 }}>
                <div className="stack" style={{ textAlign: 'right' }}>
                  <span className="mid">{String(v.total).padStart(2, '0')}</span>
                  <span className="label">{v.recent} in the last 3</span>
                </div>
                <Spark values={v.timeline} />
                <StatusToggle status={v.status} />
              </div>
            </div>
          </summary>
          <div className="stack" style={{ marginTop: 16 }}>
            <p className="reading">{v.regle}</p>
            {cards.byPattern[v.id] && (
              <div className="row between">
                <span className="label">{cards.byPattern[v.id].total} {cards.byPattern[v.id].total === 1 ? 'card' : 'cards'} · {cards.byPattern[v.id].due} due today</span>
                <Link href={`/flashcards/practice?pattern=${v.slug}`} className="btn small">Practise this pattern</Link>
              </div>
            )}
            <table className="lines">
              <thead><tr><th>When</th><th>Where</th><th>Wrong → right</th></tr></thead>
              <tbody>
                {v.occurrences.map((o) => (
                  <tr key={o.id}>
                    <td className="kicker" style={{ whiteSpace: 'nowrap' }}>{fmtDate(o.created_at, timezone)}</td>
                    <td className="kicker" style={{ whiteSpace: 'nowrap' }}>{o.kind === 'eo' ? 'Orale' : o.label || 'Écrite'}{o.tache ? ` · ${o.tache.toUpperCase()}` : ''}</td>
                    <td lang="fr"><s className="bad">{o.faux}</s> → <span className="good" style={{ fontWeight: 600 }}>{o.correct}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  );
}
