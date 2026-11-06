'use client';
import { useState } from 'react';

type Status = { source: 'env' | 'app' | null; hint: string | null };

export function KeyForm({ provider, initial, title, use, where, placeholder, onChange }: {
  provider: 'anthropic' | 'openai'; initial: Status; title: string; use: string; where: string; placeholder: string;
  onChange?: (connected: boolean) => void;
}) {
  const [st, setSt] = useState(initial);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(value: string | null) {
    setBusy(true);
    setMsg(null);
    const r = await fetch('/api/keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider, key: value }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: j.error });
    setSt(j);
    onChange?.(Boolean(j.source));
    setKey('');
    setMsg({ ok: true, text: value ? 'Key tested and saved.' : 'Key removed.' });
  }

  const on = Boolean(st.source);
  return (
    <section className="card stack">
      <div className="row between">
        <h2 className="title" style={{ fontSize: 20 }}>{title}</h2>
        <span className={`toggle ${on ? 'on' : 'dim'}`}><span>{on ? 'Connected' : 'No key'}</span><i /></span>
      </div>
      <p className="muted">{use}</p>
      {on && <p className="kicker">{st.hint} <span className="muted">· {st.source === 'env' ? 'set in Vercel (environment variable)' : 'saved in the app'}</span></p>}
      {st.source !== 'env' && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); if (key.trim()) send(key.trim()); }}>
          <label className="stack">
            <span className="label">{on ? 'Replace key' : 'Paste key'} · {where}</span>
            <input className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={placeholder}
              autoComplete="off" spellCheck={false} name={`${provider}-key`} />
          </label>
          <div className="row">
            <button className="btn solid" type="submit" disabled={busy || !key.trim()} aria-busy={busy}>{busy ? 'Testing…' : 'Test and save'}</button>
            {on && <button className="btn" type="button" disabled={busy} onClick={() => send(null)}>Remove</button>}
          </div>
        </form>
      )}
      {msg && <p className={msg.ok ? 'kicker' : 'error-box'} role="status">{msg.text}</p>}
    </section>
  );
}
