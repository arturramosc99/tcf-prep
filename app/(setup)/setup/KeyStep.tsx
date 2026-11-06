'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyForm } from '../../(app)/settings/KeyForm';
import { FORWARD } from '@/components/PageTransition';

type Status = { source: 'env' | 'app' | null; hint: string | null };

/** Paste-and-test form plus Continue / Skip for one provider of the setup guide. */
export function KeyStep({ provider, initial, next, skipNote, ...form }: {
  provider: 'anthropic' | 'openai'; initial: Status; next: string; skipNote: string;
  title: string; use: string; where: string; placeholder: string;
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(Boolean(initial.source));
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    await fetch('/api/onboarding', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ advance: provider === 'anthropic' ? 'claude' : 'openai' }) });
    router.push(next, { transitionTypes: FORWARD });
  }
  return (
    <div className="stack">
      <KeyForm provider={provider} initial={initial} onChange={setConnected} {...form} />
      <div className="row between">
        {!connected && <span className="label">{skipNote}</span>}
        <button className={`btn ${connected ? 'solid' : ''}`} type="button" disabled={busy} aria-busy={busy} onClick={go}>{connected ? 'Continue' : 'Skip for now'}</button>
      </div>
    </div>
  );
}
