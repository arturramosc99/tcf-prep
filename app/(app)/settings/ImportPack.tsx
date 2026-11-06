'use client';
import { useState } from 'react';

/** Imports a .json pack (flashcards or Écrite prompts) made outside the app — formats in docs/formats.md. */
export function ImportPack({ title, about, endpoint, noun }: { title: string; about: React.ReactNode; endpoint: string; noun: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const data = JSON.parse(await file.text());
      const r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const extra = j.problems.length ? ` ${j.problems.length} with problems: ${j.problems.slice(0, 3).join('; ')}${j.problems.length > 3 ? '…' : ''}` : '';
      setMsg({ ok: !j.problems.length, text: `${j.added} new ${noun}, ${j.skipped} already existed.${extra}` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof SyntaxError ? 'The file is not valid JSON.' : (e as Error).message });
    }
    setBusy(false);
  }

  return (
    <section className="card stack">
      <h2 className="title" style={{ fontSize: 20 }}>{title}</h2>
      <p className="muted">{about}</p>
      <label className="btn" aria-busy={busy} style={{ alignSelf: 'flex-start', width: 'fit-content' }}>
        {busy ? 'Importing…' : 'Choose a .json file'}
        <input type="file" accept="application/json,.json" hidden disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) send(f); }} />
      </label>
      {msg && <p className={msg.ok ? 'kicker' : 'error-box'} role="status">{msg.text}</p>}
    </section>
  );
}
