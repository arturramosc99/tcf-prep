// Postgres: Neon in production (DATABASE_URL), a local PGlite folder when there is no URL.
// SCHEMA runs on every boot and is split on semicolons: never put a semicolon inside a comment here.
import { neon } from '@neondatabase/serverless';

type Row = Record<string, unknown>;
type Query = (text: string, params?: unknown[]) => Promise<Row[]>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,              -- 'ee' | 'eo'
  mode TEXT NOT NULL DEFAULT 'simulado', -- 'simulado' | 'pratique' (imported history)
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'correcting' | 'done' | 'error'
  minutes INT,
  payload JSONB NOT NULL DEFAULT '{}',
  correction JSONB,
  score REAL,
  nclc TEXT,
  error TEXT
);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS correcting_since TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS consignes_used (
  tache INT NOT NULL,
  num INT NOT NULL,
  session_id INT,
  PRIMARY KEY (tache, num)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS error_patterns (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  titre TEXT NOT NULL,
  categorie TEXT NOT NULL,
  regle TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS error_occurrences (
  id SERIAL PRIMARY KEY,
  pattern_id INT NOT NULL REFERENCES error_patterns(id) ON DELETE CASCADE,
  session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tache TEXT NOT NULL,
  faux TEXT NOT NULL,
  correct TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,              -- 'mot' | 'phrase'
  prompt TEXT NOT NULL,            -- sentence with ___, a word, or "Fix: «…»"
  hint TEXT,
  answer TEXT NOT NULL,
  wrong JSONB NOT NULL,            -- distractors (the first is the real mistake when there is one)
  rule TEXT NOT NULL,
  pattern_id INT REFERENCES error_patterns(id) ON DELETE SET NULL,
  source TEXT NOT NULL,            -- 'auto' | 'base'
  dedup TEXT UNIQUE NOT NULL,
  box INT NOT NULL DEFAULT 0,      -- 0–1 multiple choice, 2–5 typing
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  streak INT NOT NULL DEFAULT 0,
  seen INT NOT NULL DEFAULT 0,
  misses INT NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Écrite prompts beyond the shipped bank: imported packs, AI-generated, pasted (see lib/consignes.ts)
CREATE TABLE IF NOT EXISTS consignes (
  id TEXT PRIMARY KEY,
  tache INT NOT NULL,
  source TEXT NOT NULL,            -- 'pack' | 'ai' | 'own'
  content JSONB NOT NULL,          -- { texte } or { titre, doc1, doc2 }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS consigne_uses (
  id TEXT PRIMARY KEY,
  tache INT NOT NULL,
  session_id INT,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- older versions recorded numbered prompts of the "pdf" pack in consignes_used
INSERT INTO consigne_uses (id, tache, session_id)
  SELECT 'pdf-t' || tache || '-' || num, tache, session_id FROM consignes_used ON CONFLICT (id) DO NOTHING;
-- cards generated before the app was translated: Portuguese prefix and hint become English
UPDATE cards SET prompt = 'Fix: ' || substr(prompt, 10), dedup = regexp_replace(dedup, '^phrase[|]corrija: ', 'phrase|fix: ')
  WHERE source = 'auto' AND prompt LIKE 'Corrija: %';
UPDATE cards SET hint = 'you wrote ' || substr(hint, 15) WHERE source = 'auto' AND hint LIKE 'você escreveu %';
`;

// kept on globalThis: in dev every route has its own copy of the module, but init must run once
const G = globalThis as unknown as { __tcfQ?: Query; __tcfReady?: Promise<void> };

async function connect(): Promise<Query> {
  const url = databaseUrl();
  if (url) {
    const sql = neon(url);
    return (text, params = []) => sql.query(text, params) as Promise<Row[]>;
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const g = globalThis as unknown as { __pglite?: InstanceType<typeof PGlite> };
  if (!g.__pglite) {
    const dir = process.env.PGLITE_DIR || '.data/pglite';
    (await import('node:fs')).mkdirSync(dir, { recursive: true });
    g.__pglite = new PGlite(dir);
  }
  const db = g.__pglite;
  return async (text, params = []) => (await db.query<Row>(text, params)).rows;
}

export async function db(): Promise<Query> {
  G.__tcfReady ??= (async () => {
    const run = (G.__tcfQ = await connect());
    for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) await run(stmt);
    const [{ n }] = (await run('SELECT count(*)::int AS n FROM sessions')) as { n: number }[];
    if (n === 0) {
      const { importLegacy } = await import('./legacy');
      await importLegacy((text, params) => run(text, params) as never);
    }
    // once: cards from the errors already recorded
    const first = await run(`INSERT INTO settings (key, value) VALUES ('cards_backfill', '1') ON CONFLICT (key) DO NOTHING RETURNING key`);
    if (first.length) {
      const { backfillCards } = await import('./cards');
      await backfillCards((text, params) => run(text, params) as never);
    }
    // once: installs that were already in use before the setup guide existed skip it (and its tips)
    const firstGuide = await run(`INSERT INTO settings (key, value) VALUES ('onboarding_init', '1') ON CONFLICT (key) DO NOTHING RETURNING key`);
    if (firstGuide.length) {
      await run(`INSERT INTO settings (key, value) SELECT 'onboarding_step', 'done'
        WHERE EXISTS (SELECT 1 FROM settings WHERE key IN ('password_hash', 'key_anthropic', 'key_openai')) OR EXISTS (SELECT 1 FROM sessions)
        ON CONFLICT (key) DO NOTHING`);
      await run(`INSERT INTO settings (key, value) SELECT 'tips_dismissed', '["*"]'
        WHERE EXISTS (SELECT 1 FROM settings WHERE key = 'onboarding_step' AND value = 'done') ON CONFLICT (key) DO NOTHING`);
    }
  })().catch((e) => { G.__tcfReady = undefined; throw e; });
  await G.__tcfReady;
  return G.__tcfQ!;
}

export async function sql<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await (await db())(text, params)) as T[];
}

/** Neon's Vercel integration sets DATABASE_URL; some setups only have POSTGRES_URL. */
const databaseUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

/** Friendly message when the database is not available (e.g. Vercel without Neon connected). */
export async function dbProblem(): Promise<string | null> {
  if (process.env.VERCEL && !databaseUrl()) return 'DATABASE_URL is not set in this deployment.';
  try {
    await db();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
