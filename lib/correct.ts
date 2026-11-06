// Background correction: the session stays 'correcting' and the client polls it.
import { structured } from './claude';
import { sql } from './db';
import { buildPromptEE, SCHEMA_EE, snapshotFor, type Snapshot, type Textes } from './ee';
import { buildPromptEO, SCHEMA_EO, type TacheEO, type TopicsEO, type TranscriptEO } from './eo';
import { recordErrors, type FoundError } from './errors';

type Correction = {
  score_global: number; nclc: string;
  taches: { id: string; erreurs: Omit<FoundError, 'tache'>[] }[];
};

export type SessionRow = {
  id: number; kind: 'ee' | 'eo'; mode: string; label: string | null; created_at: string; status: string;
  minutes: number | null; payload: Record<string, unknown>; correction: Record<string, unknown> | null;
  score: number | null; nclc: string | null; error: string | null;
};

// A correction that outlived the function limit (5 min on Vercel) died without saving anything.
const STALE_MIN = 7;

export async function getSession(id: number) {
  if (!Number.isInteger(id)) return null;
  await sql(`UPDATE sessions SET status = 'error', error = 'The correction took more than ${STALE_MIN} minutes and was stopped. Try again.'
    WHERE id = $1 AND status = 'correcting' AND correcting_since < now() - interval '${STALE_MIN} minutes'`, [id]);
  const [s] = await sql<SessionRow>('SELECT * FROM sessions WHERE id = $1', [id]);
  return s || null;
}

export async function runCorrection(id: number) {
  const s = await getSession(id);
  if (!s) return;
  try {
    let correction: Correction;
    if (s.kind === 'ee') {
      const p = s.payload as { ids: Record<string, string | number>; textes: Textes; consignes?: Snapshot };
      // sessions from older versions don't carry the prompt text: look it up
      const c = p.consignes || await snapshotFor(p.ids);
      if (!c) throw new Error('A prompt of this session is no longer available. Import your prompt pack in Settings, then try again.');
      correction = await structured<Correction>(await buildPromptEE(p.ids, c, p.textes, s.minutes || 60), SCHEMA_EE,
        'You are an experienced TCF Canada examiner. Answer only with the requested JSON.');
    } else {
      const p = s.payload as { topics: TopicsEO; transcript: TranscriptEO; durations: Record<TacheEO, number> };
      correction = await structured<Correction>(await buildPromptEO(p.topics, p.transcript, p.durations), SCHEMA_EO,
        'You are an experienced TCF Canada oral examiner (épreuve d\'expression orale). Answer only with the requested JSON.');
    }
    await recordErrors(id, correction.taches.flatMap((t) => t.erreurs.map((e) => ({ ...e, tache: t.id }))));
    await sql(`UPDATE sessions SET status = 'done', correction = $2, score = $3, nclc = $4, error = NULL WHERE id = $1`,
      [id, JSON.stringify(correction), correction.score_global, correction.nclc]);
  } catch (e) {
    await sql(`UPDATE sessions SET status = 'error', error = $2 WHERE id = $1`, [id, (e as Error).message]);
  }
}
