'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dial } from '@/components/Dial';
import { SkeletonLines } from '@/components/Skeleton';

const DURATION = 60 * 60 * 1000;
const KEY = 'tcf-ee-v2';
// Field labels are what the real exam screen shows, so they stay in French.
const FIELDS = {
  t1: { min: 60, max: 120, short: false, label: 'Votre réponse' },
  t2: { min: 120, max: 150, short: false, label: 'Votre réponse' },
  t3p1: { min: 40, max: 60, short: true, label: 'Partie 1 · Résumez les deux documents' },
  t3p2: { min: 80, max: 120, short: false, label: 'Partie 2 · Donnez votre opinion' },
} as const;
type Field = keyof typeof FIELDS;
const ACCENTS = ['é', 'è', 'ê', 'ë', 'à', 'â', 'î', 'ï', 'ô', 'û', 'ù', 'ü', 'ç', 'œ', 'É', 'À', 'Ç', '«', '»'];

type T = 't1' | 't2' | 't3';
type Ids = Record<T, string>;
type T3 = { titre: string; doc1: string; doc2: string };
type Draw = { ids: Ids; labels: Record<T, string>; t1: { texte: string }; t2: { texte: string }; t3: T3 };
type State = { ids: Ids | null; startedAt: number | null; textes: Record<Field, string>; key: string };

const words = (t: string) => (t || '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const fmt = (ms: number) => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const fresh = (): State => ({ ids: null, startedAt: null, textes: { t1: '', t2: '', t3p1: '', t3p2: '' }, key: crypto.randomUUID() });
function load(): State | null { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
function save(s: State) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

function status(id: Field, t: string) {
  const n = words(t), f = FIELDS[id];
  return n > f.max ? 'over' : n >= f.min ? 'ok' : 'low';
}

export function Written() {
  const router = useRouter();
  const [st, setSt] = useState<State | null>(null);
  const [draw, setDraw] = useState<Draw | null>(null);
  const [tab, setTab] = useState<'t1' | 't2' | 't3'>('t1');
  const [now, setNow] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [own, setOwn] = useState<T | null>(null);
  const sent = useRef(false);
  const submitRef = useRef<() => void>(() => {});

  // resume a saved draft (same prompts, same timer) or draw new prompts
  useEffect(() => {
    const s = load() || fresh();
    // localStorage only exists in the browser: the draft has to be read after mounting
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSt(s);
    const drawNew = () => fetch('/api/ee/draw', { method: 'POST' });
    (s.ids ? fetch(`/api/ee/draw?ids=${s.ids.t1},${s.ids.t2},${s.ids.t3}`).then((r) => (r.status === 404 && !s.startedAt ? drawNew() : r)) : drawNew())
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setDraw(j);
        setSt((prev) => { const n = { ...(prev || s), ids: j.ids }; save(n); return n; });
      }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!st?.startedAt) return;
    const end = st.startedAt + DURATION;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= end) { clearInterval(t); submitRef.current(); } // time is up: submit automatically
    }, 500);
    return () => clearInterval(t);
  }, [st?.startedAt]);

  const left = st?.startedAt ? Math.max(0, st.startedAt + DURATION - now) : DURATION;

  async function submit() {
    if (!st || sent.current) return;
    sent.current = true;
    setSending(true);
    setConfirm(false);
    const minutes = Math.round((Math.min(Date.now(), st.startedAt! + DURATION) - st.startedAt!) / 60000);
    try {
      const r = await fetch('/api/sessions', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'ee', key: st.key, minutes, payload: { ids: st.ids, textes: st.textes } }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      localStorage.removeItem(KEY);
      router.push(`/session/${j.id}`);
    } catch (e) {
      sent.current = false;
      setSending(false);
      setError(`${(e as Error).message} Your texts are still saved in this browser; try sending again.`);
    }
  }

  useEffect(() => { submitRef.current = submit; });

  const setText = (id: Field, v: string) => setSt((p) => { const n = { ...p!, textes: { ...p!.textes, [id]: v } }; save(n); return n; });
  const pending = useMemo(() => st ? (Object.keys(FIELDS) as Field[]).filter((f) => status(f, st.textes[f]) !== 'ok') : [], [st]);

  if (error && !draw) return <p className="error-box">{error}</p>;
  if (!st || !draw) {
    return (
      <div className="grid split">
        <section className="card stack">
          <h1 className="title">Expression écrite · 60 minutes</h1>
          <p className="reading">Drawing three prompts you haven&apos;t practised yet. When they run out, Claude writes new ones, which can take up to a minute.</p>
          <SkeletonLines n={4} />
        </section>
        <section className="card soft" style={{ display: 'grid', placeItems: 'center' }}>
          <Dial working label="Drawing prompts"><div><div className="mid">60:00</div><div className="label">drawing prompts</div></div></Dial>
        </section>
      </div>
    );
  }

  if (!st.startedAt) {
    return (
      <div className="grid split">
        <section className="card stack">
          <h1 className="title">Expression écrite · 60 minutes</h1>
          <p className="reading">Three tâches drawn from the prompts you haven&apos;t practised yet. The timer starts when you click and never pauses; you can switch between tâches as on exam day. No spell-checker. At 00:00 the fields lock and your texts go to correction.</p>
          <table className="lines"><tbody>
            {([['t1', 'Message', '60–120 words'], ['t2', 'Récit + opinion', '120–150 words'], ['t3', 'Synthèse + opinion', '40–60 + 80–120 words']] as const).map(([t, name, words]) => (
              <tr key={t}>
                <td className="kicker" style={{ whiteSpace: 'nowrap' }}>Tâche {t.slice(1)}</td>
                <td>
                  <span lang="fr">{name}</span>
                  <div className="label">{draw.labels[t]} · {words}</div>
                  <button className="menu-btn" type="button" onClick={() => setOwn(t)}>Use my own prompt</button>
                </td>
              </tr>
            ))}
          </tbody></table>
          {own && <OwnPrompt tache={own} onCancel={() => setOwn(null)} onSaved={(r) => {
            setDraw((d) => d && { ...d, ids: { ...d.ids, [own]: r.id }, labels: { ...d.labels, [own]: r.label }, [own]: r.content });
            setSt((p) => { const n = { ...p!, ids: { ...p!.ids!, [own]: r.id } }; save(n); return n; });
            setOwn(null);
          }} />}
          <div className="row">
            <button className="btn solid" onClick={() => { const n = { ...st, startedAt: Date.now() }; save(n); setSt(n); }}>Start the exam</button>
            <button className="btn" onClick={() => { localStorage.removeItem(KEY); location.reload(); }}>Draw other prompts</button>
          </div>
        </section>
        <section className="card soft stack" style={{ display: 'grid', placeItems: 'center' }}>
          <Dial fraction={1} label="60 minutes"><div><div className="mid">60:00</div><div className="label">ready</div></div></Dial>
        </section>
      </div>
    );
  }

  const locked = left === 0 || sending;
  const tabState = (t: 't1' | 't2' | 't3') => {
    const ids: Field[] = t === 't3' ? ['t3p1', 't3p2'] : [t];
    const ss = ids.map((f) => status(f, st.textes[f]));
    return ss.includes('over') ? 'over' : ss.every((x) => x === 'ok') ? 'ok' : '';
  };

  const field = (id: Field) => {
    const f = FIELDS[id], n = words(st.textes[id]), s = status(id, st.textes[id]);
    return (
      <div className="stack" key={id}>
        <label className="label" htmlFor={id} lang="fr">{f.label}</label>
        <textarea id={id} className={`exam ${f.short ? 'short' : ''}`} value={st.textes[id]} disabled={locked}
          onChange={(e) => setText(id, e.target.value)} spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off"
          data-gramm="false" data-enable-grammarly="false" translate="no" lang="fr" />
        <div className="row between">
          <div className="keys" aria-label="Accented characters">
            {ACCENTS.map((k) => (
              <button key={k} type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => {
                const ta = document.getElementById(id) as HTMLTextAreaElement;
                ta.setRangeText(k, ta.selectionStart, ta.selectionEnd, 'end');
                setText(id, ta.value);
              }}>{k}</button>
            ))}
          </div>
          <span className="kicker"><b>{n}</b> words · {f.min}–{f.max} · <span className="muted">{s === 'ok' ? 'within the limit' : s === 'over' ? `${n - f.max} too many` : n ? `${f.min - n} to go` : 'empty'}</span></span>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="sticky">
        <div className="row between">
          <div className="tabs" role="tablist">
            {(['t1', 't2', 't3'] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); scrollTo(0, 0); }}>
                <span className={`state ${tabState(t)}`} />Tâche {t.slice(1)}
              </button>
            ))}
          </div>
          <div className="row">
            <span className="mid" aria-live="off" style={{ fontSize: 26 }}>{fmt(left)}</span>
            <button className="btn solid small" disabled={locked} aria-busy={sending} onClick={() => setConfirm(true)}>{sending ? 'Sending…' : 'Finish'}</button>
          </div>
        </div>
      </div>
      {error && <p className="error-box" style={{ marginTop: 16 }}>{error} <button className="btn small" onClick={submit}>Send again</button></p>}
      <div className="grid split" style={{ marginTop: 20 }}>
        <section className="stack swap" lang="fr" key={tab}>
          <span className="label" lang="en">Tâche {tab.slice(1)} · {draw.labels[tab]}</span>
          {tab === 't1' && <><h2 className="title">Message</h2><span className="label">60 à 120 mots · conseil : 10–15 min</span><p className="consigne">{draw.t1.texte}</p></>}
          {tab === 't2' && <><h2 className="title">Récit d&apos;expérience</h2><span className="label">120 à 150 mots · conseil : 20 min</span><p className="consigne">{draw.t2.texte}</p></>}
          {tab === 't3' && (
            <>
              <h2 className="title">{draw.t3.titre}</h2>
              <span className="label">Partie 1 : 40–60 mots · Partie 2 : 80–120 mots · conseil : 25–30 min</span>
              <div className="doc stack"><span className="label">Document 1</span><p className="consigne">{draw.t3.doc1}</p></div>
              <div className="doc stack"><span className="label">Document 2</span><p className="consigne">{draw.t3.doc2}</p></div>
            </>
          )}
        </section>
        <section className="stack">
          {tab === 't3' ? [field('t3p1'), field('t3p2')] : field(tab)}
        </section>
      </div>
      {confirm && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="stack">
            <h3 className="title" style={{ fontSize: 20 }}>Finish the exam?</h3>
            <p>{pending.length ? `Outside the limit or incomplete: ${pending.map((p) => ({ t1: 'Tâche 1', t2: 'Tâche 2', t3p1: 'T3 partie 1', t3p2: 'T3 partie 2' })[p]).join(', ')}. ` : 'All four fields are within the limit. '}{fmt(left)} left. You can&apos;t edit after sending.</p>
            <div className="row">
              <button className="btn" onClick={() => setConfirm(false)}>Keep writing</button>
              <button className="btn solid" onClick={submit} autoFocus>Send for correction</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type Saved = { id: string; label: string; content: { texte: string } | T3 };

/** Paste a prompt found elsewhere (a prep website, a book) to practise with it in this simulation. */
function OwnPrompt({ tache, onCancel, onSaved }: { tache: T; onCancel: () => void; onSaved: (r: Saved) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    setError('');
    const r = await fetch('/api/ee/custom', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tache: Number(tache.slice(1)), content: f }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setError(j.error);
    onSaved(j);
  }
  return (
    <form className="card soft stack" onSubmit={submit}>
      <h2 className="title" style={{ fontSize: 20 }}>Your prompt for Tâche {tache.slice(1)}</h2>
      <p className="muted">Paste a prompt you found elsewhere, for example on <a href="https://reussir-tcfcanada.com" target="_blank" rel="noreferrer">reussir-tcfcanada.com</a> or in a prep book. It replaces the drawn prompt for this simulation only.</p>
      {tache === 't3' ? (
        <>
          <label className="stack"><span className="label">Title (the debate)</span><input className="input" name="titre" required maxLength={2500} lang="fr" /></label>
          <label className="stack"><span className="label">Document 1</span><textarea className="notes" name="doc1" required maxLength={2500} lang="fr" /></label>
          <label className="stack"><span className="label">Document 2</span><textarea className="notes" name="doc2" required maxLength={2500} lang="fr" /></label>
        </>
      ) : (
        <label className="stack"><span className="label">Prompt</span><textarea className="notes" name="texte" required maxLength={2500} lang="fr" /></label>
      )}
      {error && <p className="error-box" role="alert">{error}</p>}
      <div className="row">
        <button className="btn solid" type="submit" disabled={busy} aria-busy={busy}>{busy ? 'Saving…' : 'Use this prompt'}</button>
        <button className="btn" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
