// Advanced, optional: one-time import of a history exported from another tool (seed.json format).
// Runs by itself when the database is empty and LEGACY_DIR points to a folder with seed.json.
import fs from 'node:fs';
import path from 'node:path';
import type { sql as SqlFn } from './db';

// Personal history never lives in the repository: point LEGACY_DIR at a folder outside it.
const DIR = process.env.LEGACY_DIR || path.join(process.cwd(), 'data', 'legacy');
type Seed = {
  sessions: Record<string, { date: string; label: string; file?: string }>;
  patterns: { slug: string; titre: string; categorie: string; regle: string; occ: [string, string, string, string][] }[];
};

export async function importLegacy(sql: typeof SqlFn) {
  if (!fs.existsSync(path.join(DIR, 'seed.json'))) return;
  const [{ n }] = await sql<{ n: number }>(`SELECT count(*)::int AS n FROM sessions WHERE payload->>'legacy' IS NOT NULL`);
  if (n > 0) {
    console.log(`History already imported (${n} sessions). Nothing to do.`);
    return;
  }
  const seed: Seed = JSON.parse(fs.readFileSync(path.join(DIR, 'seed.json'), 'utf8'));
  const ids: Record<string, number> = {};

  for (const [key, s] of Object.entries(seed.sessions)) {
    if (s.file) {
      const d = JSON.parse(fs.readFileSync(path.join(DIR, s.file), 'utf8'));
      const [row] = await sql<{ id: number }>(
        `INSERT INTO sessions (kind, mode, label, created_at, status, minutes, payload, correction, score, nclc)
         VALUES ('ee', 'simulado', $1, $2, 'done', $3, $4, $5, $6, $7) RETURNING id`,
        [s.label, s.date, d.minutes, JSON.stringify({ ids: d.ids, textes: d.textes, legacy: key }),
          JSON.stringify(d.correction), d.correction.score_global, d.correction.nclc]);
      ids[key] = row.id;
    } else {
      const [row] = await sql<{ id: number }>(
        `INSERT INTO sessions (kind, mode, label, created_at, status, payload)
         VALUES ('ee', 'pratique', $1, $2, 'done', $3) RETURNING id`,
        [s.label, s.date, JSON.stringify({ legacy: key })]);
      ids[key] = row.id;
    }
  }

  let occ = 0;
  for (const p of seed.patterns) {
    const [row] = await sql<{ id: number }>(
      `INSERT INTO error_patterns (slug, titre, categorie, regle) VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET titre = EXCLUDED.titre RETURNING id`,
      [p.slug, p.titre, p.categorie, p.regle]);
    for (const [s, tache, faux, correct] of p.occ) {
      await sql('INSERT INTO error_occurrences (pattern_id, session_id, tache, faux, correct) VALUES ($1, $2, $3, $4, $5)',
        [row.id, ids[s], tache, faux, correct]);
      occ++;
    }
  }

  // prompts already practised: the line of numbers right below each "## Tâche N"
  const md = fs.readFileSync(path.join(DIR, 'consignes-praticadas.md'), 'utf8');
  let used = 0;
  for (const n of [1, 2, 3]) {
    const sec = md.split(/^## /m).find((x) => x.startsWith(`Tâche ${n}`)) || '';
    const line = sec.split('\n').find((l) => /^\d+(\s*,\s*\d+)*\s*$/.test(l.trim())) || '';
    for (const num of line.split(',').map((x) => Number(x.trim())).filter(Boolean)) {
      await sql('INSERT INTO consignes_used (tache, num) VALUES ($1, $2) ON CONFLICT DO NOTHING', [n, num]);
      used++;
    }
  }
  console.log(`Imported: ${Object.keys(ids).length} sessions, ${seed.patterns.length} patterns, ${occ} occurrences, ${used} practised prompts.`);
}

