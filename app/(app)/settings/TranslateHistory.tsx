'use client';
import { useState } from 'react';

/** Shown only when the database still holds Portuguese text written before the app switched to English. */
export function TranslateHistory({ patterns, cards, sessions }: { patterns: number; cards: number; sessions: number }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function run() {
    setBusy(true);
    setMsg(null);
    let done = 0, left = Infinity;
    try {
      for (;;) {
        const r = await fetch('/api/translate', { method: 'POST' });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        done += j.done;
        if (j.left === 0 || j.left >= left) break; // finished, or a batch made no progress
        left = j.left;
        setMsg({ ok: true, text: `Translated ${done} texts… ${j.left} to go.` });
      }
      // no refresh: the card would disappear with its message; it's gone on the next visit
      setMsg({ ok: true, text: `Done: ${done} texts translated.` });
    } catch (e) {
      setMsg({ ok: false, text: `${(e as Error).message}${done ? ` (${done} texts were already translated.)` : ''}` });
    }
    setBusy(false);
  }
  return (
    <section className="card stack">
      <h2 className="title" style={{ fontSize: 20 }}>Older history in Portuguese</h2>
      <p className="muted">Some of your data was written before the app switched to English: {patterns} error patterns, {cards} flashcards
        and {sessions} corrected sessions. Claude can translate the explanations to English; French examples and your texts stay as they are.
        It costs a few cents (usually under US$0.50 in total) and takes a minute or two.</p>
      <button className="btn solid" type="button" disabled={busy} aria-busy={busy} onClick={run} style={{ alignSelf: 'flex-start' }}>{busy ? 'Translating…' : 'Translate to English'}</button>
      {msg && <p className={msg.ok ? 'kicker' : 'error-box'} role="status">{msg.text}</p>}
    </section>
  );
}
