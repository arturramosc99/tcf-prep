// Expression écrite: prompts, word count, correction schema and correction prompt.
import fs from 'node:fs';
import path from 'node:path';
import { patternsForPrompt } from './errors';
import { readOnboarding } from './onboarding';
import { SCALE_TEXT, targetLine } from './scale';
import { legacyId, resolve, type Content } from './consignes';

export const LIMITS = {
  t1: { min: 60, max: 120 },
  t2: { min: 120, max: 150 },
  t3p1: { min: 40, max: 60 },
  t3p2: { min: 80, max: 120 },
} as const;

export type Textes = { t1: string; t2: string; t3p1: string; t3p2: string };
/** The prompt texts a session was written against, saved with the session. */
export type Snapshot = { t1: { texte: string }; t2: { texte: string }; t3: { titre: string; doc1: string; doc2: string } };

export const read = (f: string) => fs.readFileSync(path.join(process.cwd(), 'data', f), 'utf8');

export function countWords(t: string) {
  return (t || '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Looks up the three prompts; old sessions stored plain numbers of the "pdf" pack. Null if one is missing. */
export async function snapshotFor(ids: Record<string, string | number>): Promise<Snapshot | null> {
  const out: Partial<Record<'t1' | 't2' | 't3', Content>> = {};
  for (const n of [1, 2, 3] as const) {
    const c = await resolve(n, legacyId(n, ids[`t${n}`]));
    if (!c) return null;
    out[`t${n}`] = c.content;
  }
  return out as Snapshot;
}

const ERREUR = {
  type: 'object',
  required: ['categorie', 'faux', 'correct', 'regle', 'recurrent', 'pattern_slug'],
  properties: {
    categorie: { type: 'string', description: 'Error category in English (e.g. "Agreement", "Spelling", "Verb tenses")' },
    faux: { type: 'string', description: 'The wrong form, copied from the candidate (French)' },
    correct: { type: 'string', description: 'The right form (French)' },
    regle: { type: 'string', description: 'The rule in one sentence, in English' },
    recurrent: { type: 'boolean' },
    historique: { type: 'string', description: 'If recurring: how many times / where it appeared before' },
    pattern_slug: { type: 'string', description: 'Slug of an existing pattern from the list; for a new pattern, make up a short kebab-case slug' },
    nouveau_titre: { type: 'string', description: 'Only for a new pattern: a short title in English' },
  },
};

export const SCHEMA_EE = {
  type: 'object',
  required: ['score_global', 'nclc', 'fourchette', 'objectif_atteint', 'verdict', 'taches', 'priorites'],
  properties: {
    score_global: { type: 'number', description: 'Estimated Expression écrite score out of 20' },
    nclc: { type: 'string', description: 'E.g. "NCLC 6"' },
    fourchette: { type: 'string', description: 'Likely range, e.g. "8–10 / 20"' },
    objectif_atteint: { type: 'boolean', description: "true if the estimated score reaches the candidate's target" },
    verdict: { type: 'string', description: '2–3 direct sentences in English' },
    taches: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'note', 'mots', 'mots_ok', 'adequation_ok', 'adequation', 'ce_qui_marche', 'erreurs', 'version_corrigee', 'version_b2'],
        properties: {
          id: { type: 'string', enum: ['t1', 't2', 't3'] },
          note: { type: 'number', description: 'Estimated score for this tâche out of 20' },
          mots: { type: 'string', description: 'E.g. "107 words (limit 60–120) — ok"; for T3 give both parts' },
          mots_ok: { type: 'boolean' },
          adequation_ok: { type: 'boolean' },
          adequation: { type: 'array', items: { type: 'string' }, description: 'Concrete points about task fulfilment, in English' },
          ce_qui_marche: { type: 'string', description: 'One sentence in English: what worked and why' },
          erreurs: { type: 'array', items: ERREUR },
          version_corrigee: { type: 'string', description: "The candidate's text with only the errors fixed, changing as little as possible" },
          version_b2: { type: 'string', description: "Model version above B2 (B2+/C1), rewritten from the candidate's text" },
        },
      },
    },
    priorites: {
      type: 'array',
      description: '3 priorities in English, most important first',
      items: { type: 'object', required: ['titre', 'detail'], properties: { titre: { type: 'string' }, detail: { type: 'string' } } },
    },
  },
};

export const ERREUR_SCHEMA = ERREUR;

export async function buildPromptEE(ids: Record<string, string | number>, c: Snapshot, textes: Textes, minutes: number) {
  const w = { t1: countWords(textes.t1), t2: countWords(textes.t2), p1: countWords(textes.t3p1), p2: countWords(textes.t3p2) };
  return `You are the Expression écrite examiner for a TCF Canada candidate. This is a FULL SIMULATION: the three tâches in one hour. Time used: ${minutes} min.

Follow the method, the task structure and the error patterns below exactly. Write every explanation in English; French phrases stay in French. No empty praise.

=== METHOD ===
${read('correction-method.md')}

=== TASK STRUCTURE ===
${read('task-structure.md')}

=== ERROR PATTERNS ALREADY RECORDED (slug in brackets) ===
${await patternsForPrompt()}

=== SCALE ===
${SCALE_TEXT}
${targetLine((await readOnboarding()).target)}
Criteria: task fulfilment (every element, verb tense, register, word limit), coherence and cohesion, vocabulary, grammar and spelling. Task fulfilment weighs more than grammar. An empty or nearly empty text means a very low score for that tâche. Being outside the word limit is penalised.
The overall score is a holistic estimate of the three tâches. Be realistic and calibrated — neither generous nor harsh.

=== WORD COUNT (done by the app, splitting on spaces) ===
Tâche 1: ${w.t1} (limit 60–120)
Tâche 2: ${w.t2} (limit 120–150)
Tâche 3 Partie 1: ${w.p1} (limit 40–60) · Partie 2: ${w.p2} (limit 80–120) · total ${w.p1 + w.p2}

=== TÂCHE 1 — prompt #${ids.t1} ===
${c.t1.texte}

--- Candidate's text ---
${textes.t1 || '(empty)'}

=== TÂCHE 2 — prompt #${ids.t2} ===
${c.t2.texte}

--- Candidate's text ---
${textes.t2 || '(empty)'}

=== TÂCHE 3 — prompt #${ids.t3} : ${c.t3.titre} ===
Document 1 : ${c.t3.doc1}
Document 2 : ${c.t3.doc2}

--- Candidate's Partie 1 ---
${textes.t3p1 || '(empty)'}

--- Candidate's Partie 2 ---
${textes.t3p2 || '(empty)'}

=== WHAT TO RETURN ===
JSON in the requested schema. For each tâche: word count against the limit; task fulfilment first (concrete points); one sentence on what worked; errors grouped by pattern (wrong form → right form → rule in one sentence). For each error, set pattern_slug to the slug of a pattern from the list when the error belongs to it (and set recurrent=true, with historique giving the count); for a new pattern, make up a short kebab-case slug and fill nouveau_titre. Full corrected version keeping the candidate's ideas and changing as little as possible (for T3, separate "Partie 1:" and "Partie 2:").

In version_b2, rewrite the candidate's text as it would read at a level clearly above B2 (B2+/C1): start from the SAME ideas, information and plan (do not write a different text), fix every error you pointed out and lift what pulled the score down — fulfilment of the prompt (every element asked for, register, opening and closing formulas), paragraphing, varied connectors, precise vocabulary, complex sentences (relative clauses, subjunctive, gerund, sequence of tenses). Respect the tâche's word limit (for T3, "Partie 1:" 40–60 and "Partie 2:" 80–120). End with 3 concrete priorities for the next practice.`;
}
