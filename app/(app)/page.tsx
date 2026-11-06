import { requirePage } from '@/lib/auth';
import Link from 'next/link';
import { Tip } from '@/components/Tip';
import { Ring } from '@/components/Ring';
import { StatusToggle } from '@/components/StatusToggle';
import { remaining } from '@/lib/consignes';
import { keyStatus } from '@/lib/settings';
import { patternViews } from '@/lib/errors';
import { cardStats } from '@/lib/cards';
import { cecrFor, nclcFor } from '@/lib/scale';
import { fmtDate, fmtScore, scoredSessions, summary } from '@/lib/stats';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { target: TARGET, timezone } = await requirePage();
  const [list, patterns, left, ka, ko, cards] = await Promise.all([scoredSessions(), patternViews(), remaining(), keyStatus('anthropic'), keyStatus('openai'), cardStats()]);
  const missing = [!ka.source && 'Claude (correction)', !ko.source && 'OpenAI (Oral examiner voice)'].filter(Boolean);
  const ee = summary(list.filter((s) => s.kind === 'ee'));
  const eo = summary(list.filter((s) => s.kind === 'eo'));
  const urgent = patterns.filter((p) => p.status === 'critique' || p.status === 'actif').slice(0, 5);

  const block = (name: string, href: string, s: typeof ee, detail: string) => (
    <section className="card stack">
      <div className="row between" style={{ flexWrap: 'nowrap' }}>
        <h2 className="title" style={{ minWidth: 0 }}>{name}</h2>
        {s.last && <Ring value={s.last.score} max={TARGET.min}>{Math.min(100, Math.round((s.last.score / TARGET.min) * 100))}%</Ring>}
      </div>
      <div className="row" style={{ alignItems: 'flex-end', gap: 20 }}>
        <span className="big">{fmtScore(s.last?.score)}</span>
        <span className="stack" style={{ paddingBottom: 6 }}>
          <span className="mid">{s.last ? `NCLC ${nclcFor(s.last.score)}` : 'No score yet'}</span>
          <span className="label">{s.last ? `${cecrFor(s.last.score)} · last score /20 · ${fmtDate(s.last.created_at, timezone)}` : 'take your first simulation'}</span>
        </span>
      </div>
      <table className="lines">
        <tbody>
          <tr><td className="label">Average of the last 3</td><td className="kicker">{fmtScore(s.avg3)}</td></tr>
          <tr><td className="label">Best score</td><td className="kicker">{fmtScore(s.best)}</td></tr>
          <tr><td className="label">Corrected simulations</td><td className="kicker">{s.count}</td></tr>
          <tr><td className="label">Target</td><td className="kicker">{TARGET.min}–{TARGET.max} /20 <span style={{ whiteSpace: 'nowrap' }}>(NCLC {TARGET.nclc})</span></td></tr>
        </tbody>
      </table>
      <div className="row between">
        <span className="label">{detail}</span>
        <Link href={href} className="btn solid">Start simulation</Link>
      </div>
    </section>
  );

  return (
    <div className="grid">
      <Tip id="home">Your dashboard: latest scores against your target, flashcards due today and the error patterns to work on now.</Tip>
      {missing.length > 0 && (
        <section className="error-box row between">
          <span>Not connected yet: {missing.join(' and ')}.</span>
          <Link href="/settings" className="btn small">Open Settings</Link>
        </section>
      )}
      <div className="grid two">
        {block('Expression écrite', '/written', ee, `60 min · unused prompts: T1 ${left.t1} · T2 ${left.t2} · T3 ${left.t3}${left.t1 && left.t2 && left.t3 ? '' : ' — new ones will be written by Claude'}`)}
        {block('Expression orale', '/oral', eo, '12 min · 3 tâches with a voice examiner')}
      </div>
      {cards.total > 0 && (
        <section className="card soft row between">
          <span className="row" style={{ gap: 16 }}>
            <span className="mid">{String(cards.due).padStart(2, '0')}</span>
            <span className="stack"><span className="title" style={{ fontSize: 20 }}>Flashcards due today</span><span className="label">{cards.choice} multiple choice · {cards.typing} typing · {cards.mastered} mastered</span></span>
          </span>
          <Link href={cards.due ? '/flashcards/practice' : '/flashcards'} className={`btn ${cards.due ? 'solid' : ''}`}>{cards.due ? 'Practise' : 'See cards'}</Link>
        </section>
      )}
      <section className="card soft stack">
        <div className="row between">
          <h2 className="title">Work on now</h2>
          <Link href="/errors" className="btn small">All errors</Link>
        </div>
        {urgent.length ? (
          <table className="lines">
            <tbody>
              {urgent.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/errors#${p.slug}`}>{p.titre}</Link><div className="label">{p.recent} in the last 3{p.occurrences[0] && <> · latest: <s className="bad" lang="fr">{p.occurrences[0].faux}</s> → <span className="good" lang="fr">{p.occurrences[0].correct}</span></>}</div></td>
                  <td style={{ textAlign: 'right' }}><StatusToggle status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">No critical or active patterns. Take a simulation to update this.</p>}
      </section>
    </div>
  );
}
