// Expression orale: the 3-tâche script, topic generation, examiner instructions and correction.
import { sql } from './db';
import { ERREUR_SCHEMA } from './ee';
import { patternsForPrompt } from './errors';
import { readOnboarding } from './onboarding';
import { SCALE_TEXT, targetLine } from './scale';

export const TACHES_EO = {
  t1: { titre: 'Entretien dirigé', prep: 0, duree: 120, resume: 'Sans préparation · 2 min' },
  t2: { titre: 'Exercice en interaction', prep: 120, duree: 210, resume: '2 min de préparation · 3 min 30' },
  t3: { titre: "Expression d'un point de vue", prep: 0, duree: 270, resume: 'Sans préparation · 4 min 30' },
} as const;
export type TacheEO = keyof typeof TACHES_EO;

export type TopicsEO = {
  t2: { situation: string; role: string; pistes: string[] };
  t3: { sujet: string };
};

const TOPICS_SCHEMA = {
  type: 'object',
  required: ['t2', 't3'],
  properties: {
    t2: {
      type: 'object',
      required: ['situation', 'role', 'pistes'],
      properties: {
        situation: { type: 'string', description: 'Prompt in French, second person plural, as in the TCF: context + "Vous posez des questions à… pour…"' },
        role: { type: 'string', description: 'The role the examiner plays, in French (e.g. "le responsable du club de sport")' },
        pistes: { type: 'array', items: { type: 'string' }, description: '4 to 6 short possible question topics, in French' },
      },
    },
    t3: {
      type: 'object',
      required: ['sujet'],
      properties: { sujet: { type: 'string', description: 'A debatable statement or question in French, 1–2 sentences, TCF style (e.g. « Le télétravail devrait devenir la norme. Qu\'en pensez-vous ? »)' } },
    },
  },
};

export async function generateTopics(): Promise<TopicsEO> {
  const { structured } = await import('./claude');
  const prev = await sql<{ payload: { topics?: TopicsEO } }>(`SELECT payload FROM sessions WHERE kind = 'eo' ORDER BY created_at DESC LIMIT 40`);
  const done = prev.map((p) => p.payload.topics).filter(Boolean) as TopicsEO[];
  const prompt = `Create the topics for a TCF Canada Expression orale simulation (target level B2).

Tâche 2 — exercice en interaction: an everyday situation in Canada or in a French-speaking country where the candidate must get information by asking questions to someone (signing up for a course, renting, travel, a service, a club, work, a purchase…). Official prompt format: "Vous … Vous posez des questions à … pour …".

Tâche 3 — expression d'un point de vue: a social topic (technology, work, education, environment, cities, health, consumption, culture, immigration, family…) phrased as a statement or question that allows arguing for and against.

Vary the domains. Do NOT repeat or paraphrase any of these topics already used:
${done.map((t) => `- T2: ${t.t2.situation}\n- T3: ${t.t3.sujet}`).join('\n') || '(none)'}`;
  return structured<TopicsEO>(prompt, TOPICS_SCHEMA, 'You write exam topics in the official TCF Canada style. Answer only with the requested JSON.');
}

const BASE = `Tu es examinateur ou examinatrice du TCF Canada, épreuve d'expression orale. Tu parles uniquement en français standard, à un débit naturel, et tu vouvoies le candidat. Tu ne corriges jamais le candidat, tu ne donnes aucun feedback, aucune note, aucun conseil, et tu ne passes jamais à une autre langue même si le candidat le fait. Tes interventions sont courtes : le candidat doit parler beaucoup plus que toi. Si le candidat ne comprend pas, reformule plus simplement en français.`;

export function examinerInstructions(t: TacheEO, topics: TopicsEO): string {
  if (t === 't1') return `${BASE}

Tâche 1 — Entretien dirigé (2 minutes, sans préparation). Commence exactement par : « Bonjour. Nous allons commencer la première tâche. Pouvez-vous vous présenter, s'il vous plaît ? » Ensuite, après chaque réponse, pose UNE question simple et directe sur sa vie : famille, travail ou études, ville où il habite, loisirs, parcours, projets au Canada. Rebondis sur ce qu'il vient de dire.
- Ta question se dit en moins de 4 secondes : environ 10 mots maximum. Exemples : « Que faites-vous dans votre travail ? », « Pourquoi avez-vous choisi cette ville ? », « Qu'est-ce que vous faites le week-end ? »
- Une seule question à la fois : jamais deux questions enchaînées, jamais de question à plusieurs parties (« … et pourquoi, et comment… »), pas de longue mise en contexte.
- Au maximum un mot de transition très court avant (« D'accord. », « Merci. »), jamais de commentaire sur sa réponse ni de reformulation de ce qu'il a dit.
Comme dans un vrai entretien, tu peux interrompre poliment une réponse trop longue pour passer à une autre question.`;
  if (t === 't2') return `${BASE}

Tâche 2 — Exercice en interaction (3 minutes 30). Tu joues un rôle : ${topics.t2.role}.
Situation donnée au candidat : « ${topics.t2.situation} »
C'est le candidat qui pose les questions et qui doit parler le plus ; toi, tu es bref et direct, comme un vrai interlocuteur au guichet ou au téléphone.
- Accueil : une seule phrase très courte dans ton rôle (par exemple « Bonjour, je vous écoute. »), puis tu attends.
- Chaque réponse : UNE seule phrase courte (environ 15 mots maximum), qui répond uniquement à la question posée, avec un détail concret (prix, horaire, condition) inventé de manière cohérente. Exemple : « C'est 45 dollars par mois, matériel compris. »
- Pas d'introduction ni de formule de remplissage (« Excellente question », « Alors, écoutez », « Bien sûr, je vais vous expliquer »). Ne répète pas la question, n'énumère pas plusieurs options, n'ajoute aucune information non demandée et ne pose pas de question de ton côté.
- Si la question est vague, réponds court et laisse le candidat préciser.
- Si le candidat se tait plusieurs secondes, dis seulement : « Avez-vous d'autres questions ? »
- Si le candidat prend congé, réponds par une formule de politesse très courte.`;
  return `${BASE}

Tâche 3 — Expression d'un point de vue (4 minutes 30, sans préparation). Dis exactement : « Voici le sujet : ${topics.t3.sujet} Quel est votre point de vue ? » Ensuite, tu ne parles plus du tout jusqu'à la fin de la tâche, même si le candidat se tait longtemps : c'est un monologue. Ne donne jamais ton opinion.`;
}

export type Utterance = { who: 'examinateur' | 'candidat'; t: number; text: string };
export type TranscriptEO = Record<TacheEO, Utterance[]>;

export function speechStats(utts: Utterance[], seconds: number) {
  const words = utts.filter((u) => u.who === 'candidat').map((u) => u.text).join(' ').split(/\s+/).filter(Boolean).length;
  const exam = utts.filter((u) => u.who === 'examinateur').map((u) => u.text).join(' ').split(/\s+/).filter(Boolean).length;
  return { words, exam, wpm: seconds ? Math.round(words / (seconds / 60)) : 0 };
}

export const SCHEMA_EO = {
  type: 'object',
  required: ['score_global', 'nclc', 'cecr', 'fourchette', 'objectif_atteint', 'verdict', 'taches', 'priorites'],
  properties: {
    score_global: { type: 'number', description: 'Estimated Expression orale score out of 20' },
    nclc: { type: 'string', description: 'E.g. "NCLC 6"' },
    cecr: { type: 'string', description: 'CEFR level, e.g. "B1"' },
    fourchette: { type: 'string', description: 'Likely range, e.g. "8–10 / 20"' },
    objectif_atteint: { type: 'boolean', description: "true if the estimated score reaches the candidate's target" },
    verdict: { type: 'string', description: '2–3 direct sentences in English' },
    taches: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'note', 'adequation_ok', 'adequation', 'interaction', 'fluidite', 'lexique', 'ce_qui_marche', 'erreurs', 'reformulations', 'version_b2'],
        properties: {
          id: { type: 'string', enum: ['t1', 't2', 't3'] },
          note: { type: 'number', description: 'Estimated score for this tâche out of 20' },
          adequation_ok: { type: 'boolean' },
          adequation: { type: 'array', items: { type: 'string' }, description: 'Concrete points about task fulfilment, in English' },
          interaction: { type: 'string', description: 'In English. T1/T2: quality of questions/answers and register; T3: how the argument is organised' },
          fluidite: { type: 'string', description: 'In English: fluency estimate from amount of speech, pace and hesitations visible in the transcript' },
          lexique: { type: 'string', description: 'In English: range and precision of vocabulary' },
          ce_qui_marche: { type: 'string', description: 'One sentence in English: what worked and why' },
          erreurs: { type: 'array', items: ERREUR_SCHEMA },
          reformulations: {
            type: 'array',
            description: "2 to 4 of the candidate's phrases rewritten in natural spoken French at B2/C1 level",
            items: { type: 'object', required: ['original', 'ameliore'], properties: { original: { type: 'string' }, ameliore: { type: 'string' } } },
          },
          version_b2: { type: 'string', description: "The candidate's whole answer rewritten above B2 (B2+/C1), based on what they said" },
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

export async function buildPromptEO(topics: TopicsEO, transcript: TranscriptEO, durations: Record<TacheEO, number>) {
  const block = (t: TacheEO) => {
    const utts = transcript[t] || [];
    const st = speechStats(utts, durations[t]);
    const lines = utts.map((u) => `[${String(Math.floor(u.t / 60)).padStart(2, '0')}:${String(Math.round(u.t % 60)).padStart(2, '0')}] ${u.who === 'candidat' ? 'CANDIDAT' : 'EXAMINATEUR'}: ${u.text}`).join('\n');
    return `Actual duration: ${durations[t]} s · candidate words: ${st.words} (~${st.wpm} words/min) · examiner words: ${st.exam}\n${lines || '(no transcribed speech)'}`;
  };
  return `You are the Expression orale examiner for a TCF Canada candidate. This is the AUTOMATIC TRANSCRIPT of a full oral simulation (3 tâches, 12 min) done with an AI voice examiner.

Assess it as a TCF examiner would, knowing you only have text: pronunciation cannot be observed; fluency can only be estimated from the amount of speech, the pace (words/min) and the hesitations, repetitions and unfinished sentences in the transcript. Say so when relevant, without inventing. Automatic transcription can contain small recognition errors: do not penalise errors that clearly come from speech recognition (a homophone that is right in context), but do penalise obvious grammar and structure errors.

Write every explanation in English; French phrases stay in French. No empty praise. Task fulfilment comes before grammar.

=== CRITERIA PER TÂCHE ===
T1 Entretien dirigé: introduce oneself and talk about oneself in detail, give developed answers, suitable register. Answers that are too short pull the score down.
T2 Exercice en interaction: the CANDIDATE leads, asking varied questions relevant to the situation (well formed: inversion, est-ce que, question words), reacting to the answers, opening and closing politely. Few or badly formed questions pull the score down.
T3 Point de vue: a clear position, arguments structured with connectors, examples, a nuance or counter-argument, a conclusion; using the time.

=== ERROR PATTERNS ALREADY RECORDED (slug in brackets; they apply to speaking too) ===
${await patternsForPrompt()}

=== SCALE ===
${SCALE_TEXT}
${targetLine((await readOnboarding()).target)} Be realistic and calibrated.

=== TÂCHE 1 — Entretien dirigé (2 min) ===
${block('t1')}

=== TÂCHE 2 — Exercice en interaction (3 min 30, after 2 min of preparation) ===
Situation: ${topics.t2.situation}
Examiner's role: ${topics.t2.role}
${block('t2')}

=== TÂCHE 3 — Expression d'un point de vue (4 min 30) ===
Sujet: ${topics.t3.sujet}
${block('t3')}

=== WHAT TO RETURN ===
JSON in the requested schema. For each error, set pattern_slug to the slug of a pattern from the list when the error belongs to it (recurrent=true, historique with the count); for a new pattern, make up a short kebab-case slug and fill nouveau_titre.

In version_b2, rewrite the candidate's speech for the whole tâche as it would sound at a level clearly above B2 (B2+/C1), in natural spoken French (not formal written French): start from the SAME ideas, information and opinions they gave (do not invent a different answer), fix every error you pointed out and develop what was short or thin. T1: their answers to the examiner's questions, in order, each starting with "— ". T2: only the candidate's turns, in order, each starting with "— ", from greeting to goodbye, with varied, well-formed questions (theirs, improved, plus the ones missing to fulfil the situation). T3: the whole monologue, with a clear position, arguments with connectors, an example, a nuance and a conclusion, at a length that fits 4 min 30 (about 350–450 words). If the tâche had no speech, write a short model answer for the situation.

End with 3 concrete priorities for the next oral practice.`;
}
