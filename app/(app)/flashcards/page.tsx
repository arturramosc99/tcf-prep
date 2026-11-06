import Link from 'next/link';
import { Tip } from '@/components/Tip';
import { requirePage } from '@/lib/auth';
import { StatusToggle } from '@/components/StatusToggle';
import { cardStats, ROUND } from '@/lib/cards';
import { patternViews } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export default async function Flashcards() {
  await requirePage();
  const [st, views] = await Promise.all([cardStats(), patternViews()]);
  const withCards = views.filter((v) => st.byPattern[v.id]);
  return (
    <div className="grid">
      <Tip id="flashcards">Cards are made from your corrected mistakes. Get one right and it moves on to typing; get it wrong and it comes back as multiple choice. Reviews get further apart as you improve.</Tip>
      <section className="card stack">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div className="stack">
            <h1 className="title">Flashcards</h1>
            <p className="muted reading">Your recurring errors become cards. First you pick the right form; once you get it right, you type it from scratch. Get it wrong and it goes back to multiple choice.</p>
          </div>
        </div>
        <div className="row" style={{ alignItems: 'flex-end', gap: 20 }}>
          <span className="big">{String(st.due).padStart(2, '0')}</span>
          <span className="stack" style={{ paddingBottom: 6 }}>
            <span className="title">due today</span>
            <span className="label">rounds of up to {ROUND} cards · critical first</span>
          </span>
        </div>
        <table className="lines">
          <tbody>
            <tr><td className="label">Multiple choice</td><td className="kicker">{st.choice}</td></tr>
            <tr><td className="label">Typing from scratch</td><td className="kicker">{st.typing}</td></tr>
            <tr><td className="label">Mastered (16-day interval)</td><td className="kicker">{st.mastered}</td></tr>
            <tr><td className="label">Total</td><td className="kicker">{st.total}</td></tr>
          </tbody>
        </table>
        <div className="row between">
          {st.total === 0
            ? <span className="label">No cards yet. Do a simulation, or import a card pack in <Link href="/settings">Settings</Link>.</span>
            : <span className="label">{st.due ? 'Today\'s due cards, one at a time.' : 'Nothing due right now. Practise a pattern below if you like.'}</span>}
          {st.due > 0 && <Link href="/flashcards/practice" className="btn solid">Practise now</Link>}
        </div>
      </section>

      {withCards.length > 0 && (
        <section className="card soft stack">
          <h2 className="title">By error pattern</h2>
          <table className="lines">
            <tbody>
              {withCards.map((v) => (
                <tr key={v.id}>
                  <td>
                    <Link href={`/errors#${v.slug}`}>{v.titre}</Link>
                    <div className="label">{st.byPattern[v.id].total} {st.byPattern[v.id].total === 1 ? 'card' : 'cards'} · {st.byPattern[v.id].due} due today</div>
                  </td>
                  <td style={{ textAlign: 'right' }}><StatusToggle status={v.status} /></td>
                  <td style={{ textAlign: 'right', width: 1 }}><Link href={`/flashcards/practice?pattern=${v.slug}`} className="btn small">Practise</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
