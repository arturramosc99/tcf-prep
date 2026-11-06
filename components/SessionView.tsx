'use client';
import { useEffect, useState } from 'react';
import { cecrFor, nclcFor, scoreTone, type Target } from '@/lib/scale';
import { consigneLabel, legacyId } from '@/lib/consigne-ids';
import { Dial } from '@/components/Dial';
import { SkeletonLines } from '@/components/Skeleton';

type Err = { categorie: string; faux: string; correct: string; regle: string; recurrent?: boolean; historique?: string };
type Tache = {
  id: 't1' | 't2' | 't3'; note: number; erreurs: Err[]; ce_qui_marche?: string; adequation?: string[]; adequation_ok?: boolean;
  mots?: string; mots_ok?: boolean; version_corrigee?: string; version_b2?: string;
  interaction?: string; fluidite?: string; lexique?: string; reformulations?: { original: string; ameliore: string }[];
};
type Correction = { score_global: number; nclc: string; fourchette: string; verdict: string; taches: Tache[]; priorites: { titre: string; detail: string }[] };
type Utt = { who: string; t: number; text: string };
type Session = {
  id: number; kind: 'ee' | 'eo'; status: string; error: string | null; minutes: number | null; created_at: string;
  payload: {
    ids?: Record<string, number | string>; textes?: Record<string, string>;
    consignes?: Record<string, { texte?: string; titre?: string; doc1?: string; doc2?: string }>;
    topics?: { t2: { situation: string }; t3: { sujet: string } }; transcript?: Record<string, Utt[]>;
  };
  correction: Correction | null;
};


const TITLES = {
  ee: { t1: 'Tâche 1 · Message', t2: 'Tâche 2 · Récit', t3: 'Tâche 3 · Synthèse et opinion' },
  eo: { t1: 'Tâche 1 · Entretien dirigé', t2: 'Tâche 2 · Interaction', t3: "Tâche 3 · Point de vue" },
};

export function SessionView({ id, target }: { id: number; target: Target }) {
  const tone = (n: number) => scoreTone(n, target);
  const [s, setS] = useState<Session | null>(null);
  const [err, setErr] = useState('');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let stop = false;
    const t0 = Date.now();
    const load = async () => {
      try {
        const r = await fetch(`/api/sessions/${id}`, { cache: 'no-store' });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        if (stop) return;
        setS(j);
        if (j.status === 'correcting') setTimeout(load, 4000);
      } catch (e) { setErr((e as Error).message); }
    };
    load();
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => { stop = true; clearInterval(tick); };
  }, [id]);

  if (err) return <p className="error-box">{err}</p>;
  if (!s) {
    return (
      <div className="grid" aria-busy="true" aria-label="Loading">
        <section className="card stack"><span className="sk short" /><span className="sk big" /><span className="sk" /></section>
        <section className="card soft stack"><SkeletonLines n={3} /></section>
      </div>
    );
  }

  if (s.status === 'correcting') {
    const clock = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
    return (
      <div className="grid split">
        <section className="card stack">
          <h1 className="title">Correction in progress</h1>
          <p className="reading">The corrector reads {s.kind === 'ee' ? 'your three texts' : 'the transcript of the three tâches'} together with your error history, then scores each tâche.</p>
          <p className="muted reading">It usually takes 1 to 4 minutes. You can close this page and come back from History.</p>
        </section>
        <section className="card soft" style={{ display: 'grid', placeItems: 'center' }}>
          <Dial working label="Correction in progress">
            <div><div className="mid" aria-hidden="true">{clock}</div><div className="label">correcting</div></div>
          </Dial>
        </section>
      </div>
    );
  }
  if (s.status === 'error') {
    return (
      <section className="card stack reading">
        <h1 className="title">The correction did not run</h1>
        <p className="error-box">{s.error}</p>
        <p className="muted">Your texts and transcript are saved in this session.</p>
        <button className="btn solid" onClick={async () => { await fetch(`/api/sessions/${id}/retry`, { method: 'POST' }); location.reload(); }}>Correct again</button>
      </section>
    );
  }
  const c = s.correction;
  if (!c) return <p className="muted">This session has no correction.</p>;
  const titles = TITLES[s.kind];

  return (
    <div className="grid">
      <section className="card">
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div className="stack">
            <span className="label">{s.kind === 'ee' ? 'Expression écrite' : 'Expression orale'} · estimated score /20 · {c.fourchette}</span>
            <span className={`big ${tone(c.score_global)}`}>{c.score_global.toFixed(1).padStart(4, '0')}</span>
          </div>
          <div className="stack">
            <span className={`mid ${tone(c.score_global)}`}>NCLC {nclcFor(c.score_global)}</span>
            <span className="label">{cecrFor(c.score_global)} · target NCLC {target.nclc} = {target.min}–{target.max}</span>
          </div>
        </div>
        <p className="reading" style={{ marginTop: 18 }}>{c.verdict}</p>
      </section>

      <section className="card soft">
        <h2 className="label" style={{ marginBottom: 6 }}>Priorities for your next practice</h2>
        <table className="lines"><tbody>
          {c.priorites.map((p, i) => (
            <tr key={i}><td className="kicker" style={{ width: 28 }}>{i + 1}</td><td><b style={{ fontWeight: 600 }}>{p.titre}</b><div className="muted">{p.detail}</div></td></tr>
          ))}
        </tbody></table>
      </section>

      {c.taches.map((t) => (
        <section key={t.id} className="card stack">
          <div className="row between">
            <h2 className="title" style={{ fontSize: 20 }}>{titles[t.id]}{s.payload.ids ? <span className="muted"> · {consigneLabel(legacyId(Number(t.id.slice(1)), s.payload.ids[t.id]))}</span> : null}</h2>
            <span className={`mid ${tone(t.note)}`}>{t.note}<span className="label"> /20</span></span>
          </div>
          <div className="row">
            {t.mots && <span className={`toggle ${t.mots_ok ? 'good' : 'warn'}`}><span>{t.mots}</span><i /></span>}
            <span className={`toggle ${t.adequation_ok ? 'good' : 'warn'}`}><span>Task fulfilment {t.adequation_ok ? 'ok' : 'has gaps'}</span><i /></span>
          </div>
          {!!t.adequation?.length && (
            <div className={`tone ${t.adequation_ok ? 'good' : 'warn'} reading`}>
              <span className="label">{t.adequation_ok ? 'Task fulfilment' : 'What was missing for the task'}</span>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{t.adequation.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          {t.ce_qui_marche && <p className="tone good reading"><span className="label">What worked · </span>{t.ce_qui_marche}</p>}
          {(t.interaction || t.fluidite || t.lexique) && (
            <table className="lines"><tbody>
              {t.interaction && <tr><td className="label" style={{ width: 120 }}>Interaction</td><td>{t.interaction}</td></tr>}
              {t.fluidite && <tr><td className="label">Fluency</td><td>{t.fluidite}</td></tr>}
              {t.lexique && <tr><td className="label">Vocabulary</td><td>{t.lexique}</td></tr>}
            </tbody></table>
          )}
          {!!t.erreurs.length && (
            <div className="errs" role="table" aria-label="Errors">
              <div className="err head" role="row"><span role="columnheader">Wrong</span><span role="columnheader">Right</span><span role="columnheader">Rule</span></div>
              {t.erreurs.map((e, i) => (
                <div className="err" role="row" key={i}>
                  <s className="bad" role="cell" lang="fr">{e.faux}</s>
                  <span className="good" role="cell" style={{ fontWeight: 600 }} lang="fr">{e.correct}</span>
                  <span role="cell">{e.recurrent && <span className="dot bad" title="Recurring error" style={{ marginRight: 6 }} />}{e.regle}{e.historique && <span className="label" style={{ display: 'block' }}>{e.historique}</span>}</span>
                </div>
              ))}
            </div>
          )}
          {!!t.reformulations?.length && (
            <table className="lines">
              <thead><tr><th>You said</th><th>More natural</th></tr></thead>
              <tbody>
              {t.reformulations.map((r, i) => <tr key={i}><td className="warn" style={{ width: '45%' }} lang="fr">{r.original}</td><td className="good" lang="fr">{r.ameliore}</td></tr>)}
            </tbody></table>
          )}
          {s.payload.consignes?.[t.id] && (
            <details>
              <summary className="kicker" style={{ cursor: 'pointer' }}>The prompt</summary>
              <div className="stack" lang="fr" style={{ marginTop: 12 }}>
                {Object.entries(s.payload.consignes[t.id]).map(([k, v]) => <p key={k} className="consigne">{k === 'titre' ? <b>{v}</b> : v}</p>)}
              </div>
            </details>
          )}
          {t.version_b2 && (
            <details open>
              <summary className="kicker" style={{ cursor: 'pointer' }}>B2+ version of {s.kind === 'ee' ? 'your text' : 'your answers'}</summary>
              <div className="tone good stack" style={{ marginTop: 12 }}>
                <span className="label">Same ideas, errors fixed, above B2</span>
                <p style={{ whiteSpace: 'pre-wrap' }} lang="fr">{t.version_b2}</p>
              </div>
            </details>
          )}
          {t.version_corrigee && (
            <details>
              <summary className="kicker" style={{ cursor: 'pointer' }}>Corrected version and original text</summary>
              <div className="grid two" style={{ marginTop: 12 }}>
                <div className="stack"><span className="label">Your text</span><p style={{ whiteSpace: 'pre-wrap' }} lang="fr">{t.id === 't3' ? `Partie 1:\n${s.payload.textes?.t3p1}\n\nPartie 2:\n${s.payload.textes?.t3p2}` : s.payload.textes?.[t.id]}</p></div>
                <div className="tone good stack"><span className="label">Corrected</span><p style={{ whiteSpace: 'pre-wrap' }} lang="fr">{t.version_corrigee}</p></div>
              </div>
            </details>
          )}
          {s.kind === 'eo' && !!s.payload.transcript?.[t.id]?.length && (
            <details>
              <summary className="kicker" style={{ cursor: 'pointer' }}>Transcript</summary>
              {s.payload.transcript[t.id].map((u, i) => (
                <div key={i} className="utt" lang="fr"><b lang="en">{u.who === 'candidat' ? 'You' : 'Examiner'} · {Math.floor(u.t / 60)}:{String(Math.round(u.t % 60)).padStart(2, '0')}</b>{u.text}</div>
              ))}
            </details>
          )}
        </section>
      ))}
    </div>
  );
}
