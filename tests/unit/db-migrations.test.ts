// Schema upgrades that run on every boot must be idempotent and bring old rows up to date.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

before(() => {
  process.env.PGLITE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tcf-unit-db-'));
  delete process.env.DATABASE_URL;
  process.env.LEGACY_DIR = path.join(os.tmpdir(), 'tcf-no-legacy');
});

const reboot = () => { (globalThis as { __tcfReady?: unknown }).__tcfReady = undefined; };

test('auto cards written in Portuguese are rewritten in English on boot', async () => {
  const { sql } = await import('../../lib/db');
  await sql(`INSERT INTO cards (kind, prompt, hint, answer, wrong, rule, source, dedup) VALUES
    ('phrase', 'Corrija: «je vais au travail»', NULL, 'je vais travailler', '["x"]', 'r', 'auto', 'phrase|corrija: «je vais au travail»|je vais travailler'),
    ('mot', '___', 'você escreveu “a”', 'à', '["a"]', 'r', 'auto', 'mot|___|à')`);
  reboot();
  await sql('SELECT 1');
  reboot();
  await sql('SELECT 1'); // twice: must be idempotent
  const rows = await sql<{ prompt: string; hint: string | null; dedup: string }>('SELECT prompt, hint, dedup FROM cards ORDER BY id');
  assert.deepEqual(rows, [
    { prompt: 'Fix: «je vais au travail»', hint: null, dedup: 'phrase|fix: «je vais au travail»|je vais travailler' },
    { prompt: '___', hint: 'you wrote “a”', dedup: 'mot|___|à' },
  ]);
});
