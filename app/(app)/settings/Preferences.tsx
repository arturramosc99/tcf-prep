'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const post = (body: object) => fetch('/api/onboarding', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

/** NCLC target, timezone for dates, and the way back into the setup guide and page tips. */
export function Preferences({ target, timezone }: { target: number; timezone?: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const zones = Intl.supportedValuesOf('timeZone');
  const save = async (body: object, text: string) => {
    const r = await post(body);
    setMsg(r.ok ? text : (await r.json()).error);
  };
  return (
    <section className="card stack">
      <h2 className="title" style={{ fontSize: 20 }}>Preferences and setup guide</h2>
      <div className="grid two">
        <label className="stack">
          <span className="label">Your target</span>
          <span className="select"><select className="input" defaultValue={target} onChange={(e) => save({ target: Number(e.target.value) }, 'Target saved.')}>
            {[4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>NCLC {n}</option>)}
          </select></span>
        </label>
        <label className="stack">
          <span className="label">Timezone for dates</span>
          <span className="select"><select className="input" defaultValue={timezone || ''} onChange={(e) => save({ timezone: e.target.value }, 'Timezone saved.')}>
            {!timezone && <option value="">Server default (UTC)</option>}
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select></span>
        </label>
      </div>
      <div className="row">
        <button className="btn" type="button" onClick={async () => { await post({ resetTips: true }); router.push('/welcome?replay=1'); }}>Replay the setup guide</button>
        <button className="btn" type="button" onClick={() => save({ resetTips: true }, 'Page tips will show again.')}>Show page tips again</button>
      </div>
      {msg && <p className="kicker" role="status">{msg}</p>}
    </section>
  );
}
