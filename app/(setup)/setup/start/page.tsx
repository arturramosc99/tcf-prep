import { requirePage } from '@/lib/auth';
import { StartButtons } from './StartButtons';

export const dynamic = 'force-dynamic';

const TOUR: [string, string][] = [
  ['Written', 'Expression écrite: 3 tâches in 60 minutes, typed as on exam day. The correction takes 1–4 minutes: a score out of 20, your NCLC level, every error explained and a B2+ rewrite of your own text.'],
  ['Oral', 'Expression orale: 3 tâches in 12 minutes with an examiner who talks to you. Use headphones. Your transcript is corrected the same way.'],
  ['Flashcards', 'Your corrected mistakes become cards automatically: first multiple choice, then typing from scratch. Free — no API.'],
  ['Errors', 'The patterns that keep coming back, with a status from critical to resolved, so you know what to work on.'],
  ['History', 'Your scores over time. Open any session to reread its correction.'],
];

export default async function SetupStart() {
  const o = await requirePage({ setup: true });
  return (
    <div className="grid split">
      <section className="stack reading">
        <span className="label">Setup · step 4 of 4</span>
        <h1 className="title">You&apos;re ready</h1>
        <table className="lines"><tbody>
          {TOUR.map(([name, text]) => <tr key={name}><td className="kicker" style={{ width: 110 }}>{name}</td><td>{text}</td></tr>)}
        </tbody></table>
        <p className="muted">Start with a Written simulation: it&apos;s the cheapest and shows how corrections work. Small tips appear the first time you open each page.</p>
      </section>
      <section className="card stack">
        <StartButtons target={o.target.nclc} />
      </section>
    </div>
  );
}
