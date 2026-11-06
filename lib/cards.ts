// Flashcards from errors: storage, the daily round and pack import. Pure rules live in cardrules.ts.
import { sql } from './db';
import { patternViews } from './errors';
import { ORDER } from './status';
import { checkImported, dedupKey, draftFromError, nextBox, nextDue, type Card, type CardDraft } from './cardrules';

type Run = typeof sql;
type Row = CardDraft & { pattern_id: number | null; source: 'auto' | 'base' };

/** Inserts many cards in one query. `reset`: if the card exists, the error came back → box 0, due today. */
async function insertCards(run: Run, rows: Row[], reset: boolean) {
  const seen = new Set<string>();
  const uniq = rows.filter((r) => { const k = dedupKey(r); if (seen.has(k)) return false; seen.add(k); return true; });
  if (!uniq.length) return 0;
  const params: unknown[] = [];
  const values = uniq.map((r) => {
    params.push(r.kind, r.prompt, r.hint, r.answer, JSON.stringify(r.wrong), r.rule, r.pattern_id, r.source, dedupKey(r));
    const b = params.length - 9;
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}::jsonb, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9})`;
  });
  const conflict = reset
    ? 'DO UPDATE SET box = 0, streak = 0, due_at = now(), archived = false'
    : 'DO NOTHING';
  const out = await run<{ id: number }>(
    `INSERT INTO cards (kind, prompt, hint, answer, wrong, rule, pattern_id, source, dedup) VALUES ${values.join(', ')}
     ON CONFLICT (dedup) ${conflict} RETURNING id`, params);
  return out.length;
}

/** After a correction: each error becomes a card (or reopens the existing one). Never breaks the correction. */
export async function cardsFromErrors(items: { faux: string; correct: string; regle: string; pattern_id: number }[]) {
  try {
    const rows = items.flatMap((e) => {
      const d = draftFromError(e.faux, e.correct, e.regle);
      return d ? [{ ...d, pattern_id: e.pattern_id, source: 'auto' as const }] : [];
    });
    await insertCards(sql, rows, true);
  } catch (err) {
    console.error('cards: could not create cards from the correction', err);
  }
}

/** Once, at database init: cards from every error already recorded. */
export async function backfillCards(run: Run) {
  try {
    const occ = await run<{ faux: string; correct: string; regle: string; pattern_id: number }>(
      `SELECT o.faux, o.correct, p.regle, o.pattern_id FROM error_occurrences o JOIN error_patterns p ON p.id = o.pattern_id ORDER BY o.id`);
    const rows = occ.flatMap((e) => {
      const d = draftFromError(e.faux, e.correct, e.regle);
      return d ? [{ ...d, pattern_id: e.pattern_id, source: 'auto' as const }] : [];
    });
    // in chunks, to stay under the parameter limit
    for (let i = 0; i < rows.length; i += 200) await insertCards(run, rows.slice(i, i + 200), false);
  } catch (err) {
    console.error('cards: backfill failed', err);
  }
}

type CardRow = Omit<Card, 'wrong'> & { wrong: string[] | string; due_at: string; pattern_id: number | null };
const parse = (r: CardRow): Card & { pattern_id: number | null } => ({
  id: r.id, kind: r.kind, prompt: r.prompt, hint: r.hint, answer: r.answer, rule: r.rule, box: r.box,
  wrong: typeof r.wrong === 'string' ? JSON.parse(r.wrong) : r.wrong,
  pattern_slug: r.pattern_slug, pattern_titre: r.pattern_titre, pattern_id: r.pattern_id,
});
const SELECT = `SELECT c.*, p.slug AS pattern_slug, p.titre AS pattern_titre FROM cards c LEFT JOIN error_patterns p ON p.id = c.pattern_id`;

export const ROUND = 20;

/** A round: due cards, critical and active patterns first. With `slug`, all cards of that pattern. */
export async function roundCards(slug?: string | null): Promise<Card[]> {
  if (slug) {
    const rows = await sql<CardRow>(`${SELECT} WHERE NOT c.archived AND p.slug = $1 ORDER BY c.due_at, c.id LIMIT ${ROUND}`, [slug]);
    return rows.map(parse);
  }
  const [rows, views] = await Promise.all([
    sql<CardRow>(`${SELECT} WHERE NOT c.archived AND c.due_at <= now() ORDER BY c.due_at, c.id LIMIT 500`),
    patternViews(),
  ]);
  const rank = new Map(views.map((v) => [v.id, ORDER.indexOf(v.status)]));
  const r = (c: CardRow) => (c.pattern_id != null && rank.has(c.pattern_id) ? rank.get(c.pattern_id)! : 2);
  return rows.sort((a, b) => r(a) - r(b) || a.box - b.box).slice(0, ROUND).map(parse);
}

export async function answerCard(id: number, ok: boolean) {
  const [c] = await sql<{ box: number }>('SELECT box FROM cards WHERE id = $1', [id]);
  if (!c) return null;
  const box = nextBox(c.box, ok);
  await sql(
    `UPDATE cards SET box = $2, due_at = $3, seen = seen + 1, streak = CASE WHEN $4::boolean THEN streak + 1 ELSE 0 END,
     misses = misses + CASE WHEN $4::boolean THEN 0 ELSE 1 END WHERE id = $1`,
    [id, box, nextDue(box).toISOString(), ok]);
  return { box };
}

export async function archiveCard(id: number, archived: boolean) {
  const out = await sql('UPDATE cards SET archived = $2 WHERE id = $1 RETURNING id', [id, archived]);
  return out.length > 0;
}

export type CardStats = { total: number; due: number; choice: number; typing: number; mastered: number; byPattern: Record<number, { total: number; due: number }> };

export async function cardStats(): Promise<CardStats> {
  const rows = await sql<{ pattern_id: number | null; box: number; due: boolean }>(
    'SELECT pattern_id, box, due_at <= now() AS due FROM cards WHERE NOT archived');
  const byPattern: CardStats['byPattern'] = {};
  for (const r of rows) {
    if (r.pattern_id == null) continue;
    const p = (byPattern[r.pattern_id] ??= { total: 0, due: 0 });
    p.total++;
    if (r.due) p.due++;
  }
  return {
    total: rows.length,
    due: rows.filter((r) => r.due).length,
    choice: rows.filter((r) => r.box < 2).length,
    typing: rows.filter((r) => r.box >= 2 && r.box < 5).length,
    mastered: rows.filter((r) => r.box >= 5).length,
    byPattern,
  };
}

/** Card pack (.json) imported in Settings; duplicate cards are skipped. */
export async function importCards(data: unknown) {
  const list = (data as { version?: number; cards?: unknown[] })?.cards;
  if ((data as { version?: number })?.version !== 1 || !Array.isArray(list)) return { error: 'Invalid format: expected { "version": 1, "cards": [...] }.' };
  if (list.length > 5000) return { error: 'A pack can hold at most 5000 cards.' };
  const patterns = await sql<{ id: number; slug: string }>('SELECT id, slug FROM error_patterns');
  const ids = new Map(patterns.map((p) => [p.slug, p.id]));
  const problems: string[] = [];
  const rows: Row[] = [];
  list.forEach((x, i) => {
    const why = checkImported(x);
    if (why) return void problems.push(`card ${i + 1}: ${why}`);
    const c = x as CardDraft & { pattern_slug?: string };
    rows.push({ kind: c.kind, prompt: c.prompt, hint: c.hint ?? null, answer: c.answer, wrong: c.wrong, rule: c.rule,
      pattern_id: (c.pattern_slug && ids.get(c.pattern_slug)) || null, source: 'base' });
  });
  let added = 0;
  for (let i = 0; i < rows.length; i += 200) added += await insertCards(sql, rows.slice(i, i + 200), false);
  return { added, skipped: rows.length - added, problems };
}
