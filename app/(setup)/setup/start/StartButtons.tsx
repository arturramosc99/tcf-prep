'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FORWARD } from '@/components/PageTransition';

const post = (body: object) => fetch('/api/onboarding', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

/** Target picker and the two ways out of the setup guide. */
export function StartButtons({ target }: { target: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function finish(href: string) {
    setBusy(href);
    await post({ advance: 'start' });
    router.push(href, { transitionTypes: FORWARD });
    router.refresh();
  }
  return (
    <div className="stack">
      <label className="stack">
        <span className="label">Your target</span>
        <span className="select"><select className="input" defaultValue={target} onChange={(e) => post({ target: Number(e.target.value) })}>
          {[4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>NCLC {n}</option>)}
        </select></span>
      </label>
      <p className="label">Scores are compared with this target. Express Entry points usually start at NCLC 7. You can change it in Settings.</p>
      <div className="row">
        <button className="btn solid" type="button" disabled={busy !== null} aria-busy={busy === '/written'} onClick={() => finish('/written')}>Start a Written simulation</button>
        <button className="btn" type="button" disabled={busy !== null} aria-busy={busy === '/'} onClick={() => finish('/')}>Go to the dashboard</button>
      </div>
    </div>
  );
}
