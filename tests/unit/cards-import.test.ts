import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

before(() => {
  process.env.PGLITE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tcf-unit-cards-'));
  delete process.env.DATABASE_URL;
  process.env.LEGACY_DIR = path.join(os.tmpdir(), 'tcf-no-legacy');
});

test('a card pack with too many cards is refused', async () => {
  const { importCards } = await import('../../lib/cards');
  const cards = Array.from({ length: 5001 }, (_, i) => ({ kind: 'mot', prompt: '___', answer: `a${i}`, wrong: ['b'], rule: 'r' }));
  assert.match(((await importCards({ version: 1, cards })) as { error: string }).error, /at most 5000/);
});
