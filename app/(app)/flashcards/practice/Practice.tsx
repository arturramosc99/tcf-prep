'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ACCENTS, BLANK, charDiff, isFixPrompt, same, TYPE_FROM_BOX, MAX_BOX, type Card } from '@/lib/cardrules';

type Item = Card & { options: string[]; retry: boolean };
type Result = { id: number; ok: boolean; up: boolean };
const KEYS = ACCENTS.filter((k) => k !== '«' && k !== '»');

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
};
const toItem = (c: Card, retry = false): Item => ({ ...c, retry, options: shuffle([c.answer, ...c.wrong]) });
const show = (s: string) => (s === '' ? '(nothing)' : s);

/** Sentence with the gap: empty in the question, filled with the right answer afterwards. */
function Prompt({ c, filled }: { c: Card; filled: boolean }) {
  if (!c.prompt.includes(BLANK)) return <p className="flash-prompt" lang={c.kind === 'mot' && !isFixPrompt(c.prompt) ? undefined : 'fr'}>{c.prompt}</p>;
  const [a, b] = c.prompt.split(BLANK);
  return (
    <p className="flash-prompt" lang="fr">
      {a}<span className={`blank ${filled ? 'good' : ''}`}>{filled ? c.answer : ' '}</span>{b}
    </p>
  );
}

export function Practice({ pattern }: { pattern: string | null }) {
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [i, setI] = useState(0);
  const [given, setGiven] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/cards${pattern ? `?pattern=${encodeURIComponent(pattern)}` : ''}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j.cards as Card[]; })
      .then((cards) => { if (alive) setQueue(cards.map((c) => toItem(c))); })
      .catch((e) => { if (alive) setError((e as Error).message || 'Could not load the cards.'); });
    return () => { alive = false; };
  }, [pattern]);

  if (error) return <section className="error-box">{error}</section>;
  if (!queue) {
    return (
      <section className="card stack" aria-busy="true" aria-label="Loading cards">
        <span className="sk short" /><span className="sk title" /><span className="sk" /><span className="sk" />
      </section>
    );
  }

  const c = queue[i];
  if (!c) {
    const firsts = results.filter((r, k) => results.findIndex((x) => x.id === r.id) === k);
    const ok = firsts.filter((r) => r.ok).length;
    return (
      <section className="card stack">
        <h1 className="title">{queue.length ? 'Round complete' : 'No cards to practise right now'}</h1>
        {queue.length > 0 && (
          <>
            <div className="row" style={{ alignItems: 'flex-end', gap: 20 }}>
              <span className="big">{ok}/{firsts.length}</span>
              <span className="label" style={{ paddingBottom: 6 }}>right first time</span>
            </div>
            <table className="lines">
              <tbody>
                <tr><td className="label">Moved up a level</td><td className="kicker good">{firsts.filter((r) => r.up).length}</td></tr>
                <tr><td className="label">Back to multiple choice</td><td className="kicker bad">{firsts.filter((r) => !r.ok).length}</td></tr>
              </tbody>
            </table>
          </>
        )}
        <div className="row">
          <Link href="/flashcards" className="btn solid">Back to Flashcards</Link>
          {queue.length > 0 && <button className="btn" type="button" onClick={() => window.location.reload()}>Another round</button>}
        </div>
      </section>
    );
  }

  const typing = c.box >= TYPE_FROM_BOX && !c.retry;
  const done = given !== null;
  const ok = given !== null && same(given, c.answer);

  function answer(value: string) {
    if (done) return;
    const right = same(value, c.answer);
    setGiven(value);
    // a retry in the same round doesn't touch the schedule: the first answer is the one that counts
    if (!c.retry) {
      setResults((r) => [...r, { id: c.id, ok: right, up: right && c.box < MAX_BOX }]);
      fetch(`/api/cards/${c.id}/answer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: right }) })
        .then((r) => { if (!r.ok) setError('Could not save your answer. Check your connection and reload.'); })
        .catch(() => setError('Could not save your answer. Check your connection and reload.'));
      if (!right) setQueue((q) => q && [...q, toItem({ ...c, box: 0 }, true)]);
    }
  }

  function next() {
    setGiven(null);
    setTyped('');
    setI((n) => n + 1);
  }

  async function archive() {
    await fetch(`/api/cards/${c.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ archived: true }) });
    setQueue((q) => q && q.filter((x, k) => k <= i || x.id !== c.id));
    next();
  }

  return (
    <div className="grid">
      <div className="row between">
        <span className="label">{i + 1} / {queue.length}{c.pattern_titre ? ` · ${c.pattern_titre}` : ''}</span>
        <span className="label">{typing ? 'Type it' : 'Choose'} · level {c.box}/{MAX_BOX}{c.retry ? ' · again' : ''}</span>
      </div>
      <section className="card stack flash" key={`${i}`}>
        <Prompt c={c} filled={done} />
        {c.hint && <p className="label">{c.hint}</p>}

        {!typing && (
          <div className="choices">
            {c.options.map((o, k) => {
              const tone = !done ? '' : o === c.answer ? 'good' : o === given ? 'bad' : 'dim';
              return (
                <button key={k} type="button" className={`choice ${tone}`} disabled={done} onClick={() => answer(o)} lang="fr">
                  {show(o)}
                </button>
              );
            })}
          </div>
        )}

        {typing && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) answer(typed); }}>
            <input ref={input} className="answer-input" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={done} autoFocus
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} lang="fr" aria-label="Your answer"
              data-gramm="false" data-enable-grammarly="false" />
            {!done && (
              <div className="row between">
                <div className="keys" aria-label="Accented characters">
                  {KEYS.map((k) => (
                    <button key={k} type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => {
                      const el = input.current!;
                      el.setRangeText(k, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, 'end');
                      setTyped(el.value);
                      el.focus();
                    }}>{k}</button>
                  ))}
                </div>
                <button className="btn solid" type="submit" disabled={!typed.trim()}>Check</button>
              </div>
            )}
          </form>
        )}

        {done && (
          <div className={`tone ${ok ? 'good' : 'bad'} stack`} role="status">
            <span className="label">{ok ? 'Right' : 'Wrong'}</span>
            {!ok && typing && (
              <p className="diff" lang="fr" aria-label={`You wrote ${given}; the right form is ${c.answer}`}>
                {charDiff(given ?? '', c.answer).map((s, k) => <span key={k} className={s.k}>{s.t}</span>)}
              </p>
            )}
            {!ok && <p>Right: <b lang="fr">{c.answer}</b></p>}
            <p>{c.rule}</p>
          </div>
        )}

        {done && (
          <div className="row between">
            <button className="btn small" type="button" onClick={archive} title="Removes this card from practice (e.g. a badly generated card)">Archive card</button>
            <button className="btn solid" type="button" onClick={next} autoFocus>Next</button>
          </div>
        )}
      </section>
    </div>
  );
}
