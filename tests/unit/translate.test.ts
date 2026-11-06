// Installs used before the app switched to English keep Portuguese text in the database
// (error patterns, flashcard rules, old corrections). It can be translated once, on request.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

before(() => {
  process.env.PGLITE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tcf-unit-tr-'));
  delete process.env.DATABASE_URL;
  process.env.LEGACY_DIR = path.join(os.tmpdir(), 'tcf-no-legacy');
});

const T = () => import('../../lib/translate');

test('Portuguese is recognised, French and English are not', async () => {
  const { looksPortuguese } = await T();
  for (const pt of ['Léxico impreciso/vazamento de português', 'Concordância de gênero', 'A preposição à leva acento', 'Faltou o verbo no subjuntivo', 'você escreveu “a”'])
    assert.ok(looksPortuguese(pt), pt);
  for (const no of ['Je t’attends à la gare', 'Il faut que tu viennes avec nous', 'Missing accent on the preposition à', 'Les gens que je connais sont là', 'Bank #4'])
    assert.ok(!looksPortuguese(no), no);
});

test('only Portuguese strings inside a correction are collected and replaced', async () => {
  const { collectStrings, replaceStrings } = await T();
  const c = { verdict: 'Texto adequado, mas com erros de concordância.', taches: [{ version_b2: 'Je suis allé à la gare.', erreurs: [{ regle: 'O adjetivo concorda em gênero.', faux: 'les journées sont long' }] }] };
  assert.deepEqual(collectStrings(c), ['Texto adequado, mas com erros de concordância.', 'O adjetivo concorda em gênero.']);
  const out = replaceStrings(c, new Map([['O adjetivo concorda em gênero.', 'The adjective agrees in gender.']])) as typeof c;
  assert.equal(out.taches[0].erreurs[0].regle, 'The adjective agrees in gender.');
  assert.equal(out.taches[0].version_b2, 'Je suis allé à la gare.');
});

test('translating updates patterns, cards and sessions, batch by batch, until nothing is left', async () => {
  const { sql } = await import('../../lib/db');
  const { pendingTranslation, translateBatch } = await T();
  await sql(`INSERT INTO error_patterns (slug, titre, categorie, regle) VALUES ('lexico', 'Léxico impreciso', 'Léxico', 'Usar a palavra precisa em vez de decalque do português.')`);
  await sql(`INSERT INTO cards (kind, prompt, hint, answer, wrong, rule, source, dedup) VALUES ('mot', '___', '(eu) gostaria', 'voudrais', '["voulais"]', 'Condicional para pedidos educados.', 'base', 'mot|___|voudrais')`);
  await sql(`INSERT INTO sessions (kind, status, label, correction) VALUES ('ee', 'done', 'Prática 3', $1)`,
    [JSON.stringify({ verdict: 'Bom texto, mas faltou a conclusão.', taches: [{ version_b2: 'Pour conclure, je recommande ce voyage.' }] })]);
  assert.deepEqual(await pendingTranslation(), { patterns: 1, cards: 1, sessions: 1 });

  const seen: string[][] = [];
  const fake = async (list: string[]) => { seen.push(list); return list.map((_, i) => `English ${seen.length}.${i}`); };
  let r = await translateBatch(fake, 3);
  assert.equal(seen[0].length, 3);
  assert.ok(r.left > 0);
  while (r.left > 0) r = await translateBatch(fake, 3);
  assert.deepEqual(await pendingTranslation(), { patterns: 0, cards: 0, sessions: 0 });

  const [p] = await sql<{ titre: string; regle: string }>(`SELECT titre, regle FROM error_patterns WHERE slug = 'lexico'`);
  assert.match(p.titre, /^English/);
  const [s] = await sql<{ label: string; correction: { verdict: string; taches: { version_b2: string }[] } }>(`SELECT label, correction FROM sessions`);
  assert.match(s.label, /^English/);
  assert.match(s.correction.verdict, /^English/);
  assert.equal(s.correction.taches[0].version_b2, 'Pour conclure, je recommande ce voyage.');
});

test('a translation that comes back with the wrong number of items changes nothing', async () => {
  const { sql } = await import('../../lib/db');
  const { translateBatch } = await T();
  await sql(`INSERT INTO error_patterns (slug, titre, categorie, regle) VALUES ('genero', 'Gênero dos substantivos', 'Gramática', 'Decorar o gênero junto com a palavra.')`);
  await assert.rejects(translateBatch(async () => ['only one'], 10), /translation/i);
  const [p] = await sql<{ titre: string }>(`SELECT titre FROM error_patterns WHERE slug = 'genero'`);
  assert.equal(p.titre, 'Gênero dos substantivos');
});
