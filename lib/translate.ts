// Installs used before the app switched to English keep Portuguese explanations in their database: error
// pattern titles and rules, flashcard rules and hints, old sessions' labels and corrections. On request
// (Settings), Claude translates them to English in small batches. French exam content is never touched.
import { sql } from './db';

// Words and endings that only Portuguese uses (not French or English). Matching one is enough: these strings
// are explanations, never French exam text (French fields are skipped, see FRENCH_KEYS).
const PT = new RegExp(
  '[ãõ]|ção|ções|(?<![\\p{L}.])(' + [
    'você', 'não', 'para', 'uma', 'com', 'sem', 'mas', 'muito', 'também', 'está', 'são', 'isso', 'esse', 'essa', 'este',
    'esta', 'pelo', 'pela', 'aos', 'das', 'dos', 'em', 'eu', 'nós', 'ele', 'ela', 'seu', 'sua', 'meu', 'minha', 'foi',
    'palavra', 'palavras', 'verbo', 'verbos', 'gênero', 'depois', 'antes', 'quando', 'errado', 'certo', 'regra', 'frase',
    'frases', 'acento', 'concordância', 'léxico', 'impreciso', 'faltou', 'usar', 'decalque', 'português', 'texto', 'bom',
    'boa', 'escreveu', 'prática', 'práticas', 'simulado', 'simulados', 'tarefa', 'sessão',
  ].join('|') + ')(?![\\p{L}])', 'iu');

export const looksPortuguese = (s: string) => PT.test(s);

/** Keys of a correction that hold French (the candidate's text, model rewrites): never translated. */
const FRENCH_KEYS = new Set(['faux', 'correct', 'version_corrigee', 'version_b2', 'original', 'ameliore', 'id', 'pattern_slug']);

/** Portuguese strings inside a correction, in order, without duplicates. */
export function collectStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') { if (looksPortuguese(node) && !out.includes(node)) out.push(node); }
  else if (Array.isArray(node)) node.forEach((n) => collectStrings(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) if (!FRENCH_KEYS.has(k)) collectStrings(v, out);
  }
  return out;
}

export function replaceStrings(node: unknown, map: Map<string, string>): unknown {
  if (typeof node === 'string') return map.get(node) ?? node;
  if (Array.isArray(node)) return node.map((n) => replaceStrings(n, map));
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, FRENCH_KEYS.has(k) ? v : replaceStrings(v, map)]));
  }
  return node;
}

type Pattern = { id: number; titre: string; categorie: string; regle: string };
type Card = { id: number; rule: string; hint: string | null };
type Session = { id: number; label: string | null; correction: unknown };

async function load() {
  const [patterns, cards, sessions] = await Promise.all([
    sql<Pattern>('SELECT id, titre, categorie, regle FROM error_patterns ORDER BY id'),
    sql<Card>('SELECT id, rule, hint FROM cards ORDER BY id'),
    sql<Session>('SELECT id, label, correction FROM sessions WHERE correction IS NOT NULL OR label IS NOT NULL ORDER BY id'),
  ]);
  const parse = (c: unknown) => (typeof c === 'string' ? JSON.parse(c) : c);
  return { patterns, cards, sessions: sessions.map((s) => ({ ...s, correction: parse(s.correction) })) };
}

const pt = (...xs: (string | null)[]) => xs.filter((x): x is string => !!x && looksPortuguese(x));

/** How many rows still hold Portuguese text. */
export async function pendingTranslation() {
  const { patterns, cards, sessions } = await load();
  return {
    patterns: patterns.filter((p) => pt(p.titre, p.categorie, p.regle).length).length,
    cards: cards.filter((c) => pt(c.rule, c.hint).length).length,
    sessions: sessions.filter((s) => pt(s.label).length || collectStrings(s.correction).length).length,
  };
}

function allStrings(d: Awaited<ReturnType<typeof load>>) {
  const out: string[] = [];
  const add = (xs: string[]) => xs.forEach((x) => { if (!out.includes(x)) out.push(x); });
  d.patterns.forEach((p) => add(pt(p.titre, p.categorie, p.regle)));
  d.cards.forEach((c) => add(pt(c.rule, c.hint)));
  d.sessions.forEach((s) => { add(pt(s.label)); add(collectStrings(s.correction)); });
  return out;
}

export type Translator = (list: string[]) => Promise<string[]>;

/** Translates up to `max` Portuguese strings and writes them back. `left` = strings still in Portuguese. */
export async function translateBatch(translate: Translator = claudeTranslate, max = 60) {
  const before = await load();
  const batch = allStrings(before).slice(0, max);
  if (!batch.length) return { done: 0, left: 0 };
  const result = await translate(batch);
  if (result.length !== batch.length || result.some((r) => typeof r !== 'string' || !r.trim())) {
    throw new Error('The translation came back incomplete. Nothing was changed; try again.');
  }
  const map = new Map(batch.map((s, i) => [s, result[i].trim()]));
  const m = (s: string | null) => (s == null ? s : map.get(s) ?? s);

  for (const p of before.patterns) {
    if ([p.titre, p.categorie, p.regle].some((x) => map.has(x))) {
      await sql('UPDATE error_patterns SET titre = $2, categorie = $3, regle = $4 WHERE id = $1', [p.id, m(p.titre), m(p.categorie), m(p.regle)]);
    }
  }
  for (const c of before.cards) {
    if (map.has(c.rule) || (c.hint && map.has(c.hint))) await sql('UPDATE cards SET rule = $2, hint = $3 WHERE id = $1', [c.id, m(c.rule), m(c.hint)]);
  }
  for (const s of before.sessions) {
    const correction = s.correction == null ? null : replaceStrings(s.correction, map);
    const changed = (s.label && map.has(s.label)) || JSON.stringify(correction) !== JSON.stringify(s.correction);
    if (changed) await sql('UPDATE sessions SET label = $2, correction = $3 WHERE id = $1', [s.id, m(s.label), correction == null ? null : JSON.stringify(correction)]);
  }
  return { done: batch.length, left: allStrings(await load()).length };
}

const SCHEMA = { type: 'object', required: ['translations'], properties: { translations: { type: 'array', items: { type: 'string' } } } };

export const claudeTranslate: Translator = async (list) => {
  const { structured } = await import('./claude');
  const r = await structured<{ translations: string[] }>(
    `Translate each string below from Brazilian Portuguese to English. They are explanations from a TCF Canada French course:
keep every French word, example and quotation exactly as it is (never translate French). Keep the tone and the length.
Return exactly one translation per input, in the same order. If a string is already in English, return it unchanged.

STRINGS:
${JSON.stringify(list)}`,
    SCHEMA, 'You translate app content. Answer only with the requested JSON.');
  return r.translations;
};
