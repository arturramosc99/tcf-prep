// Expression écrite prompts ("consignes") and where they come from:
// - bank-t{n}-{nnn}: the original bank shipped in data/consignes/bank.json
// - {prefix}-t{n}-{num}: a pack imported in Settings (e.g. your own prompts from a prep book)
// - ai-{uuid}: written by Claude when every other prompt for a tâche has been used
// - own-{uuid}: pasted by the user for one simulation (never drawn again)
import crypto from 'node:crypto';
import BANK from '@/data/consignes/bank.json';
import { sql } from './db';
import { consigneLabel, legacyId } from './consigne-ids';

export { consigneLabel, legacyId };

export type Tache = 1 | 2 | 3;
export type Content = { texte: string } | { titre: string; doc1: string; doc2: string };
export type Source = 'bank' | 'pack' | 'ai' | 'own';
export type Consigne = { id: string; tache: Tache; source: Source; content: Content };
export type Ids = { t1: string; t2: string; t3: string };

const RESERVED = ['bank', 'ai', 'own'];
const MAX_FIELD = 2500;
const MAX_ITEMS = 5000;


export function choose<T extends { id: string }>(pool: T[], used: Set<string>, rand = Math.random): T | null {
  const free = pool.filter((c) => !used.has(c.id));
  return free.length ? free[Math.floor(rand() * free.length)] : null;
}

/** Returns why a prompt's content is not usable, or null. */
export function contentProblem(tache: number, c: unknown): string | null {
  const o = (c || {}) as Record<string, unknown>;
  const fields = tache === 3 ? ['titre', 'doc1', 'doc2'] : ['texte'];
  for (const f of fields) {
    if (typeof o[f] !== 'string' || !(o[f] as string).trim()) return `${f} is empty`;
    if ((o[f] as string).length > MAX_FIELD) return `${f} is longer than ${MAX_FIELD} characters`;
  }
  return null;
}
const pickContent = (tache: number, c: Record<string, string>): Content =>
  tache === 3 ? { titre: c.titre.trim(), doc1: c.doc1.trim(), doc2: c.doc2.trim() } : { texte: c.texte.trim() };

type BankFile = { version: 1; t1: { id: string; texte: string }[]; t2: { id: string; texte: string }[]; t3: { id: string; titre: string; doc1: string; doc2: string }[] };

/** The original bank. CONSIGNES_BANK_LIMIT (tests only) keeps just the first N per tâche. */
export function bankItems(tache: Tache): Consigne[] {
  const limit = Number(process.env.CONSIGNES_BANK_LIMIT) || Infinity;
  return (BANK as BankFile)[`t${tache}`].slice(0, limit).map(({ id, ...content }) => ({ id, tache, source: 'bank' as const, content: content as Content }));
}

type Row = { id: string; tache: number; source: Source; content: Content | string };
const parse = (r: Row): Consigne => ({ id: r.id, tache: r.tache as Tache, source: r.source, content: typeof r.content === 'string' ? JSON.parse(r.content) : r.content });

export async function resolve(tache: number, id: string): Promise<Consigne | null> {
  const b = bankItems(tache as Tache).find((c) => c.id === id);
  if (b) return b;
  const [r] = await sql<Row>('SELECT id, tache, source, content FROM consignes WHERE id = $1 AND tache = $2', [id, tache]);
  return r ? parse(r) : null;
}

/** Prompts that can be drawn for a tâche: the bank, imported packs and earlier AI prompts. */
export async function pool(tache: Tache): Promise<Consigne[]> {
  const rows = await sql<Row>(`SELECT id, tache, source, content FROM consignes WHERE tache = $1 AND source <> 'own' ORDER BY created_at, id`, [tache]);
  return [...bankItems(tache), ...rows.map(parse)];
}

export async function usedIds(): Promise<Set<string>> {
  return new Set((await sql<{ id: string }>('SELECT id FROM consigne_uses')).map((r) => r.id));
}

export async function remaining() {
  const used = await usedIds();
  const left = async (t: Tache) => (await pool(t)).filter((c) => !used.has(c.id)).length;
  return { t1: await left(1), t2: await left(2), t3: await left(3) };
}

export async function addConsigne(tache: Tache, source: Source, content: Content, id?: string): Promise<Consigne> {
  const c = { id: id || `${source}-${crypto.randomUUID()}`, tache, source, content };
  await sql('INSERT INTO consignes (id, tache, source, content) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
    [c.id, tache, source, JSON.stringify(content)]);
  return c;
}

/** A prompt not practised yet; when there is none left, `generate` writes a new one. */
export async function pickOne(tache: Tache, generate: () => Promise<Consigne> = () => generateConsigne(tache)): Promise<Consigne> {
  return choose(await pool(tache), await usedIds()) || generate();
}

/** A prompt counts as practised when the text is submitted, even if the correction fails. */
export async function markUsed(ids: Ids, sessionId: number) {
  for (const n of [1, 2, 3] as const) {
    await sql('INSERT INTO consigne_uses (id, tache, session_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING', [ids[`t${n}`], n, sessionId]);
  }
}

type Pack = { version?: number; kind?: string; prefix?: unknown; items?: unknown[] };

/** Imports a prompt pack (docs/formats.md). Prompts already imported are skipped. */
export async function importConsignes(data: unknown, q: typeof sql = sql) {
  const p = (data || {}) as Pack;
  if (p.version !== 1 || p.kind !== 'consignes' || !Array.isArray(p.items)) {
    return { error: 'Invalid format: expected { "version": 1, "kind": "consignes", "prefix": "…", "items": [...] }.' };
  }
  if (typeof p.prefix !== 'string' || !/^[a-z]{2,20}$/.test(p.prefix) || RESERVED.includes(p.prefix)) {
    return { error: `prefix must be 2–20 lowercase letters and not one of: ${RESERVED.join(', ')}.` };
  }
  if (p.items.length > MAX_ITEMS) return { error: `A pack can hold at most ${MAX_ITEMS} prompts.` };
  const problems: string[] = [];
  let added = 0, skipped = 0;
  for (const [i, x] of p.items.entries()) {
    const o = (x || {}) as Record<string, unknown>;
    const why = ![1, 2, 3].includes(o.tache as number) ? 'tache must be 1, 2 or 3'
      : !Number.isInteger(o.num) || (o.num as number) < 1 ? 'num must be a positive whole number'
        : contentProblem(o.tache as number, o);
    if (why) { problems.push(`item ${i + 1}: ${why}`); continue; }
    const tache = o.tache as Tache;
    const id = `${p.prefix}-t${tache}-${o.num}`;
    const out = await q('INSERT INTO consignes (id, tache, source, content) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING RETURNING id',
      [id, tache, 'pack', JSON.stringify(pickContent(tache, o as Record<string, string>))]);
    if (out.length) added++; else skipped++;
  }
  return { added, skipped, problems };
}

type Numbered = { t1: Record<string, string>; t2: Record<string, string>; t3: Record<string, { titre: string; doc1: string; doc2: string }> };

/** Turns a numbered prompt file ({ t1: { "1": "…" }, …, t3: { "1": { titre, doc1, doc2 } } }) into a pack. */
export function packFromNumbered(data: Numbered, prefix: string) {
  const items = (['t1', 't2', 't3'] as const).flatMap((t) => Object.entries(data[t] || {}).map(([num, v]) => ({
    tache: Number(t.slice(1)), num: Number(num), ...(typeof v === 'string' ? { texte: v } : v),
  })));
  return { version: 1, kind: 'consignes', prefix, items };
}

/** Pasted by the user for one simulation. */
export async function addOwn(tache: Tache, content: unknown) {
  const why = contentProblem(tache, content);
  if (why) return { error: why };
  return addConsigne(tache, 'own', pickContent(tache, content as Record<string, string>));
}

const SCHEMA_T12 = { type: 'object', required: ['texte'], properties: { texte: { type: 'string' } } };
const SCHEMA_T3 = {
  type: 'object', required: ['titre', 'doc1', 'doc2'],
  properties: { titre: { type: 'string' }, doc1: { type: 'string' }, doc2: { type: 'string' } },
};
const KIND: Record<Tache, string> = {
  1: 'Tâche 1 (60–120 words): a short message — an invitation, a reply to an ad, a request or practical information for a friend, a group, a neighbour or a stranger. One or two sentences in French, second person plural ("Vous…"), ending with "(60 mots minimum / 120 mots maximum)".',
  2: 'Tâche 2 (120–150 words): telling a personal experience (a trip, an event, a new job, a course, a move…) for a blog, a newspaper or a friend, and giving an opinion. Two or three sentences in French, second person plural, ending with "(120 mots minimum / 150 mots maximum)".',
  3: 'Tâche 3: a debate title (a question, in French) and two short documents of 50–80 words each, in French, with opposite or complementary points of view, written like newspaper or blog excerpts. No names of real people or brands.',
};

/** Asks Claude for a new prompt in the style of the bank, avoiding the ones already used. */
export async function generateConsigne(tache: Tache): Promise<Consigne> {
  const { structured } = await import('./claude');
  const bank = bankItems(tache);
  const examples = Array.from({ length: Math.min(3, bank.length) }, () => bank[Math.floor(Math.random() * bank.length)]);
  const known = (await pool(tache)).slice(-60);
  const brief = (c: Consigne) => ('texte' in c.content ? c.content.texte : c.content.titre).slice(0, 140);
  const prompt = `Write ONE new prompt for the TCF Canada Expression écrite exam.

${KIND[tache]}

Style examples (do not copy them):
${examples.map((e) => `- ${JSON.stringify(e.content)}`).join('\n')}

Do NOT repeat or paraphrase any of these prompts:
${known.map((c) => `- ${brief(c)}`).join('\n') || '(none)'}`;
  const content = await structured<Content>(prompt, tache === 3 ? SCHEMA_T3 : SCHEMA_T12,
    'You write exam prompts in the official TCF Canada style, in French. Answer only with the requested JSON.');
  const why = contentProblem(tache, content);
  if (why) throw new Error(`Claude wrote an unusable prompt (${why}). Try again.`);
  return addConsigne(tache, 'ai', pickContent(tache, content as Record<string, string>));
}
