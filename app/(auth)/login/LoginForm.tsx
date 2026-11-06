'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FORWARD } from '@/components/PageTransition';

/** `preview`: the first-visit form shown disabled, when the setup guide is replayed. */
export function LoginForm({ create, preview = false }: { create: boolean; preview?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get('password') || '');
    if (create && password !== f.get('confirm')) return setError('The two passwords don\'t match.');
    setBusy(true);
    setError('');
    const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
    if (!r.ok) { setBusy(false); return setError((await r.json()).error); }
    // busy stays on until the next page replaces this one
    router.replace(create ? '/setup/claude' : '/', { transitionTypes: create ? FORWARD : [] });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card stack" style={{ width: '100%', maxWidth: 400 }}>
      {!create && <span className="brand" style={{ fontSize: 34 }}>TCF Prep</span>}
      <h1 className="title" style={{ fontSize: 20 }}>{create ? 'Create your password' : 'Log in'}</h1>
      {create && <p className="muted">It protects your simulations and API keys. You&apos;ll use it on your computer and your phone — save it in your password manager. At least 10 characters.</p>}
      <label className="stack">
        <span className="label">Password</span>
        <input className="input" name="password" type="password" autoFocus={!preview} disabled={preview} required minLength={create ? 10 : undefined}
          autoComplete={create ? 'new-password' : 'current-password'} />
      </label>
      {create && (
        <label className="stack">
          <span className="label">Repeat the password</span>
          <input className="input" name="confirm" type="password" disabled={preview} required autoComplete="new-password" />
        </label>
      )}
      {error && <p className="error-box" role="alert">{error}</p>}
      <button className="btn solid" type="submit" disabled={busy || preview} aria-busy={busy}>{busy ? 'Please wait…' : create ? 'Create password and log in' : 'Log in'}</button>
    </form>
  );
}
