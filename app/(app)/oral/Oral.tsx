'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dial } from '@/components/Dial';

// Fixed exam-day script (same as lib/eo.ts, repeated so the client doesn't import server code).
const TACHES = {
  t1: { titre: 'Entretien dirigé', prep: 0, duree: 120, resume: 'Sans préparation · 2 min' },
  t2: { titre: 'Exercice en interaction', prep: 120, duree: 210, resume: '2 min de préparation · 3 min 30' },
  t3: { titre: "Expression d'un point de vue", prep: 0, duree: 270, resume: 'Sans préparation · 4 min 30' },
} as const;
type T = keyof typeof TACHES;
type Topics = { t2: { situation: string; role: string; pistes: string[] }; t3: { sujet: string } };
type Utt = { who: 'examinateur' | 'candidat'; t: number; text: string };
type Phase = { step: 'intro' } | { step: 'prep'; t: T } | { step: 'live'; t: T } | { step: 'closing'; t: T } | { step: 'done' };

const KEY = 'tcf-eo-topics-v1';
// T1: as in the real interview, some examiners cut a long answer short and change the subject, others don't.
// Drawn per simulation (half the time) and, when on, per long answer (70%), without telling the candidate.
const INTERRUPTING_EXAMINER = 0.5;
const INTERRUPT_CHANCE = 0.7;
const INTERRUPT_AFTER = () => 35 + Math.random() * 15; // seconds of continuous candidate speech
const INTERRUPT = "Tu es l'examinateur du TCF Canada (tâche 1, entretien dirigé). Le candidat parle depuis longtemps sur le même sujet : interromps-le poliment en deux ou trois mots (« Merci. » ou « D'accord, merci. ») puis pose UNE nouvelle question simple sur un autre aspect de sa vie, d'environ 10 mots maximum (moins de 4 secondes en tout), sans question à plusieurs parties. En français, en le vouvoyant, sans commenter sa réponse.";
// When the examiner replies in T1 (T2 replies on its own server-side; T3 never replies): after `pause` ms of
// silence in which the candidate didn't speak again, and only if they spoke at least `min` ms since the examiner's last turn.
// A short burst ("euh", noise) waits SHORT_WAIT.
const REPLY: Partial<Record<T, { pause: number; min: number }>> = { t1: { pause: 1200, min: 2500 } };
const SHORT_WAIT = 4000;
const ORDER: T[] = ['t1', 't2', 't3'];
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.max(0, Math.ceil(s % 60)) % 60).padStart(2, '0')}`;

export function Oral() {
  const router = useRouter();
  const [topics, setTopics] = useState<Topics | null>(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>({ step: 'intro' });
  const [left, setLeft] = useState(0);
  const [speaking, setSpeaking] = useState<'examinateur' | 'candidat' | null>(null);
  const [live, setLive] = useState<Utt[]>([]);
  const [notes, setNotes] = useState('');
  const [showText, setShowText] = useState(false);

  const transcript = useRef<Record<T, Utt[]>>({ t1: [], t2: [], t3: [] });
  const durations = useRef<Record<T, number>>({ t1: 0, t2: 0, t3: 0 });
  const mic = useRef<MediaStream | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const t0 = useRef(0);
  const starts = useRef<Record<string, number>>({});
  const key = useRef('');

  // topics are generated once and kept until submission, so reloading the page doesn't burn new ones
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists after mounting
      if (saved) { setTopics(saved.topics); key.current = saved.key; return; }
    } catch {}
    fetch('/api/eo/topics', { method: 'POST' }).then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      key.current = crypto.randomUUID();
      try { localStorage.setItem(KEY, JSON.stringify({ topics: j, key: key.current })); } catch {}
      setTopics(j);
    }).catch((e) => setError(e.message));
  }, []);

  // timer for the current phase
  const deadline = useRef(0);
  useEffect(() => {
    if (phase.step !== 'prep' && phase.step !== 'live') return;
    const tick = setInterval(() => {
      const s = (deadline.current - Date.now()) / 1000;
      setLeft(Math.max(0, s));
      if (s <= 0) {
        clearInterval(tick);
        if (phase.step === 'prep') startLive(phase.t);
        else endTache(phase.t);
      }
    }, 250);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => { pc.current?.close(); mic.current?.getTracks().forEach((t) => t.stop()); }, []);

  const push = (t: T, u: Utt) => {
    transcript.current[t] = [...transcript.current[t], u].sort((a, b) => a.t - b.t);
    setLive([...transcript.current[t]]);
  };
  const since = () => (Date.now() - t0.current) / 1000;

  async function begin() {
    setError('');
    try {
      // unlocks audio on iPhone inside the user gesture
      audio.current!.play().catch(() => {});
      mic.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError('No microphone access. Allow the microphone for this site and try again.');
      return;
    }
    goTo('t1');
  }

  function goTo(t: T) {
    setLive([]);
    setNotes('');
    if (TACHES[t].prep) {
      deadline.current = Date.now() + TACHES[t].prep * 1000;
      setLeft(TACHES[t].prep);
      setPhase({ step: 'prep', t });
    } else startLive(t);
  }

  async function startLive(t: T) {
    setPhase({ step: 'closing', t }); // "connecting"
    try {
      const r = await fetch('/api/eo/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tache: t, topics }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);

      const conn = new RTCPeerConnection();
      pc.current = conn;
      conn.ontrack = (e) => { audio.current!.srcObject = e.streams[0]; audio.current!.play().catch(() => {}); };
      const track = mic.current!.getAudioTracks()[0];
      track.enabled = true;
      conn.addTrack(track, mic.current!);
      const dc = conn.createDataChannel('oai-events');
      starts.current = {};
      // candidate's turn: starts at their first speech after the examiner finished
      let turnStart: number | null = null;
      let limit = INTERRUPT_AFTER();
      let examinerTalking = false;
      // the examiner's reply is decided here (the server doesn't reply on its own, see api/eo/token)
      let responding = false; // a reply is in progress: don't ask for another
      let epoch = 0; // changes on every examiner turn; candidate speech that started before it doesn't count
      let heard = 0; // ms of candidate speech since the examiner's last turn
      const speech: Record<string, { at: number; epoch: number }> = {};
      let replyTimer: ReturnType<typeof setTimeout> | undefined;
      const ask = (response?: object) => {
        clearTimeout(replyTimer);
        responding = true;
        heard = 0;
        dc.send(JSON.stringify({ type: 'response.create', ...(response && { response }) }));
      };
      const scheduleReply = () => {
        clearTimeout(replyTimer);
        const rule = REPLY[t];
        if (!rule || !heard || examinerTalking || responding) return;
        replyTimer = setTimeout(() => {
          if (pc.current !== conn || dc.readyState !== 'open' || examinerTalking || responding) return;
          ask();
        }, heard >= rule.min ? rule.pause : SHORT_WAIT);
      };
      if (t === 't1' && Math.random() < INTERRUPTING_EXAMINER) {
        let willInterrupt = Math.random() < INTERRUPT_CHANCE;
        const watch = setInterval(() => {
          if (pc.current !== conn) return clearInterval(watch);
          if (turnStart === null || examinerTalking || responding || dc.readyState !== 'open') return;
          if (since() - turnStart > limit) {
            turnStart = null;
            limit = INTERRUPT_AFTER();
            const go = willInterrupt;
            willInterrupt = Math.random() < INTERRUPT_CHANCE;
            if (!go) return;
            epoch++; // the speech still in progress doesn't trigger another reply after the interruption
            ask({ instructions: INTERRUPT });
          }
        }, 1000);
      }

      dc.onmessage = (m) => {
        const ev = JSON.parse(m.data);
        switch (ev.type) {
          case 'input_audio_buffer.speech_started':
            starts.current[ev.item_id] = since(); setSpeaking('candidat');
            if (turnStart === null && !examinerTalking) turnStart = since();
            clearTimeout(replyTimer); // candidate spoke again: the examiner waits
            speech[ev.item_id] = { at: Date.now(), epoch };
            break;
          case 'input_audio_buffer.speech_stopped': {
            setSpeaking(null);
            const s = speech[ev.item_id];
            if (s?.epoch === epoch) heard += Date.now() - s.at;
            scheduleReply();
            break;
          }
          case 'conversation.item.input_audio_transcription.completed':
            if (ev.transcript?.trim()) push(t, { who: 'candidat', t: starts.current[ev.item_id] ?? since(), text: ev.transcript.trim() });
            break;
          case 'response.output_audio_transcript.delta':
            starts.current[ev.item_id] ??= since(); break;
          case 'response.output_audio_transcript.done':
            if (ev.transcript?.trim()) push(t, { who: 'examinateur', t: starts.current[ev.item_id] ?? since(), text: ev.transcript.trim() });
            break;
          case 'response.created': responding = true; break;
          case 'response.done': responding = false; scheduleReply(); break;
          case 'output_audio_buffer.started':
            examinerTalking = true; turnStart = null; setSpeaking('examinateur');
            clearTimeout(replyTimer); epoch++; heard = 0;
            break;
          case 'output_audio_buffer.stopped':
          case 'output_audio_buffer.cleared': // the candidate cut the examiner off (T2)
            examinerTalking = false; setSpeaking(null); scheduleReply(); break;
          case 'error': setError(`Realtime: ${ev.error?.message || 'error'}`); break;
        }
      };
      dc.onopen = () => {
        // the examiner opens the tâche (the instructions say how to start)
        dc.send(JSON.stringify({ type: 'response.create' }));
        t0.current = Date.now();
        deadline.current = Date.now() + TACHES[t].duree * 1000;
        setLeft(TACHES[t].duree);
        setPhase({ step: 'live', t });
      };

      // if the channel doesn't open within 20 s the connection failed (network, firewall, key)
      setTimeout(() => {
        if (dc.readyState === 'open' || pc.current !== conn) return;
        conn.close(); pc.current = null;
        mic.current?.getTracks().forEach((tr) => tr.stop()); mic.current = null;
        setError('The voice connection did not open. Check your internet connection and try again.');
        setPhase({ step: 'intro' });
      }, 20000);

      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);
      const sdp = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST', body: offer.sdp, headers: { Authorization: `Bearer ${j.value}`, 'Content-Type': 'application/sdp' },
      });
      if (!sdp.ok) throw new Error(`Could not connect the voice (${sdp.status}).`);
      await conn.setRemoteDescription({ type: 'answer', sdp: await sdp.text() });
    } catch (e) {
      setError((e as Error).message);
      pc.current?.close();
      pc.current = null;
      mic.current?.getTracks().forEach((tr) => tr.stop()); // turn the microphone off when going back to the start
      mic.current = null;
      setPhase({ step: 'intro' });
    }
  }

  async function endTache(t: T) {
    durations.current[t] = Math.round(Math.min(TACHES[t].duree, since()));
    setPhase({ step: 'closing', t });
    mic.current?.getAudioTracks().forEach((tr) => (tr.enabled = false));
    audio.current!.srcObject = null;
    setSpeaking(null);
    await new Promise((r) => setTimeout(r, 2500)); // the candidate's last transcript may still arrive
    pc.current?.close();
    pc.current = null;
    const next = ORDER[ORDER.indexOf(t) + 1];
    if (next) goTo(next);
    else submit();
  }

  async function submit() {
    setPhase({ step: 'done' });
    mic.current?.getTracks().forEach((tr) => tr.stop());
    try {
      const r = await fetch('/api/sessions', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'eo', key: key.current, minutes: 12, payload: { topics, transcript: transcript.current, durations: durations.current } }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      localStorage.removeItem(KEY);
      router.push(`/session/${j.id}`);
    } catch (e) {
      setError(`${(e as Error).message} The transcript is still on this page; try sending again.`);
    }
  }

  const cur = 't' in phase ? phase.t : null;
  const total = cur ? (phase.step === 'prep' ? TACHES[cur].prep : TACHES[cur].duree) : 1;

  return (
    <>
      <audio ref={audio} autoPlay playsInline />
      {error && <p className="error-box" style={{ marginBottom: 16 }}>{error} {phase.step === 'done' && <button className="btn small" onClick={submit}>Send again</button>}</p>}

      {phase.step === 'intro' && (
        <div className="grid split">
          <section className="card stack">
            <h1 className="title">Expression orale · 12 minutes</h1>
            <p className="reading">Three tâches in a row with an examiner who talks to you by voice. Use headphones if you can. The examiner never corrects you during the exam; at the end the transcript is sent for correction with a score out of 20 and an NCLC level.</p>
            <table className="lines"><tbody>
              {ORDER.map((t) => <tr key={t}><td className="kicker">Tâche {t.slice(1)}</td><td lang="fr">{TACHES[t].titre}</td><td className="label" lang="fr">{TACHES[t].resume}</td></tr>)}
            </tbody></table>
            <p className="label">Pronunciation can&apos;t be scored from a transcript; fluency is estimated from how much and how fast you speak.</p>
            <div className="row">
              <button className="btn solid" disabled={!topics} aria-busy={!topics} onClick={begin}>{topics ? 'Allow microphone and start' : 'Preparing topics…'}</button>
              {topics && <button className="btn" onClick={() => { localStorage.removeItem(KEY); location.reload(); }}>Generate other topics</button>}
            </div>
          </section>
          <section className="card soft" style={{ display: 'grid', placeItems: 'center' }}>
            <Dial fraction={1} label="12 minutes"><div><div className="mid">12:00</div><div className="label">3 tâches</div></div></Dial>
          </section>
        </div>
      )}

      {cur && topics && (
        <div className="grid split">
          <section className="card" style={{ display: 'grid', placeItems: 'center', gap: 16 }}>
            <span className="label">Tâche {cur.slice(1)} · <span lang="fr">{TACHES[cur].titre}</span></span>
            <Dial fraction={left / total} working={phase.step === 'closing'} label={phase.step === 'closing' ? 'Connecting' : 'Time left'}>
              <div className="stack">
                <div className="big" style={{ fontSize: 'clamp(44px, 9vw, 64px)' }}>{phase.step === 'closing' ? '··' : fmt(left)}</div>
                <div className={`kicker ${speaking ? 'speaking' : ''}`}>
                  {phase.step === 'prep' ? 'préparation' : phase.step === 'closing' ? 'connecting…' : speaking === 'examinateur' ? 'examiner speaking' : speaking === 'candidat' ? 'you are speaking' : 'listening'}
                </div>
              </div>
            </Dial>
            <div className="row">
              {phase.step === 'prep' && <button className="btn small" onClick={() => startLive(cur)}>Start now</button>}
              {phase.step === 'live' && <button className="btn small" onClick={() => endTache(cur)}>End tâche</button>}
            </div>
          </section>

          <section className="stack">
            {cur === 't1' && <p className="consigne" lang="fr">Présentez-vous et répondez aux questions de l&apos;examinateur.</p>}
            {cur === 't2' && (
              <>
                <span className="label">Situation · the examiner plays <span lang="fr">{topics.t2.role}</span></span>
                <p className="consigne" lang="fr">{topics.t2.situation}</p>
                {/* Notes stay on screen during the 3 min 30 of the interaction, as in the exam. */}
                <span className="label">Your notes</span>
                <textarea className="notes" placeholder="Draft your questions (only you see this)" value={notes} onChange={(e) => setNotes(e.target.value)} lang="fr" spellCheck={false} />
              </>
            )}
            {cur === 't3' && phase.step === 'live' && (<><span className="label">Sujet</span><p className="consigne" lang="fr">{topics.t3.sujet}</p></>)}
            {phase.step === 'live' && (
              <div>
                <button className="menu-btn" onClick={() => setShowText((v) => !v)}>{showText ? 'Hide transcript' : 'Show live transcript'}</button>
                {showText && live.map((u, i) => <div key={i} className="utt"><b>{u.who === 'candidat' ? 'You' : 'Examiner'}</b>{u.text}</div>)}
              </div>
            )}
          </section>
        </div>
      )}

      {phase.step === 'done' && !error && <p className="muted row" role="status"><span className="spinner" aria-hidden="true" />Sending the transcript for correction…</p>}
    </>
  );
}
