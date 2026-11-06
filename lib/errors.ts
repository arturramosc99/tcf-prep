import { sql } from './db';
import { ORDER, STATUS_HELP, STATUS_LABEL, statusOf, type Status } from './status';

export { STATUS_HELP, STATUS_LABEL, type Status };

export type Occurrence = {
  id: number; pattern_id: number; session_id: number; tache: string; faux: string; correct: string;
  created_at: string; kind: string; label: string | null;
};
export type PatternRow = { id: number; slug: string; titre: string; categorie: string; regle: string };
export type PatternView = PatternRow & {
  status: Status; total: number; recent: number; occurrences: Occurrence[];
  /** occurrences per session, oldest to newest (finished sessions only) */
  timeline: number[];
};

export async function doneSessionsDesc() {
  return sql<{ id: number; created_at: string; kind: string; label: string | null; mode: string }>(
    `SELECT id, created_at, kind, label, mode FROM sessions WHERE status = 'done' ORDER BY created_at DESC, id DESC`);
}

export async function patternViews(): Promise<PatternView[]> {
  const [patterns, occs, sessions] = await Promise.all([
    sql<PatternRow>('SELECT id, slug, titre, categorie, regle FROM error_patterns'),
    sql<Occurrence>(`SELECT o.*, s.created_at, s.kind, s.label FROM error_occurrences o
      JOIN sessions s ON s.id = o.session_id ORDER BY s.created_at DESC, o.id`),
    doneSessionsDesc(),
  ]);
  const ids = sessions.map((s) => s.id);
  const asc = [...ids].reverse();
  const views = patterns.map((p) => {
    const mine = occs.filter((o) => o.pattern_id === p.id);
    const occSessions = mine.map((o) => o.session_id);
    return {
      ...p,
      status: statusOf(occSessions, ids),
      total: mine.length,
      recent: occSessions.filter((s) => ids.slice(0, 3).includes(s)).length,
      occurrences: mine,
      timeline: asc.map((sid) => occSessions.filter((s) => s === sid).length),
    };
  });
  return views
    .filter((v) => v.total > 0)
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || b.recent - a.recent || b.total - a.total);
}

/** Compact list of patterns for the correction prompt. */
export async function patternsForPrompt(): Promise<string> {
  const views = await patternViews();
  if (!views.length) return '(no patterns recorded yet)';
  return views.map((v) => {
    const ex = v.occurrences.slice(0, 3).map((o) => `*${o.faux}* → *${o.correct}*`).join('; ');
    return `- [${v.slug}] ${v.titre} — ${v.total} occurrence(s), status: ${STATUS_LABEL[v.status]}. Rule: ${v.regle}${ex ? ` E.g.: ${ex}` : ''}`;
  }).join('\n');
}

export type FoundError = {
  categorie: string; faux: string; correct: string; regle: string;
  pattern_slug: string; nouveau_titre?: string; tache?: string;
};

/** Saves a correction's occurrences, creating new patterns when the slug doesn't exist. */
export async function recordErrors(sessionId: number, errors: FoundError[]) {
  await sql('DELETE FROM error_occurrences WHERE session_id = $1', [sessionId]);
  const forCards: { faux: string; correct: string; regle: string; pattern_id: number }[] = [];
  for (const e of errors) {
    const slug = (e.pattern_slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) continue;
    let [p] = await sql<{ id: number }>('SELECT id FROM error_patterns WHERE slug = $1', [slug]);
    if (!p) {
      [p] = await sql<{ id: number }>(
        `INSERT INTO error_patterns (slug, titre, categorie, regle) VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id`,
        [slug, e.nouveau_titre || e.categorie, e.categorie, e.regle]);
    }
    await sql('INSERT INTO error_occurrences (pattern_id, session_id, tache, faux, correct) VALUES ($1, $2, $3, $4, $5)',
      [p.id, sessionId, e.tache || '', e.faux, e.correct]);
    forCards.push({ faux: e.faux, correct: e.correct, regle: e.regle, pattern_id: p.id });
  }
  const { cardsFromErrors } = await import('./cards');
  await cardsFromErrors(forCards);
}

export async function exportMarkdown(): Promise<string> {
  const views = await patternViews();
  const date = new Date().toISOString().slice(0, 10);
  const lines = [`# Recurring errors — exported from TCF Prep on ${date}`, '',
    'Status: ' + ORDER.map((s) => `**${STATUS_LABEL[s]}** = ${STATUS_HELP[s]}`).join('; ') + '.', ''];
  for (const s of ORDER) {
    const group = views.filter((v) => v.status === s);
    if (!group.length) continue;
    lines.push(`## ${STATUS_LABEL[s]}`, '');
    for (const v of group) {
      lines.push(`### ${v.titre} — ${v.total} occurrence(s)`, v.regle, '');
      for (const o of v.occurrences) {
        lines.push(`- ${new Date(o.created_at).toISOString().slice(0, 10)} · ${o.label || o.kind.toUpperCase()} ${o.tache}: *${o.faux}* → *${o.correct}*`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}
