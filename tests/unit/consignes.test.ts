// Écrite prompts: the original bank, imported packs, AI-generated and pasted prompts.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

before(() => {
  process.env.PGLITE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tcf-unit-consignes-'));
  delete process.env.DATABASE_URL;
  delete process.env.CONSIGNES_BANK_LIMIT;
  process.env.LEGACY_DIR = path.join(os.tmpdir(), 'tcf-no-legacy');
});

const C = () => import('../../lib/consignes');

test('legacyId maps old numeric prompt ids to the "pdf" pack', async () => {
  const { legacyId } = await C();
  assert.equal(legacyId(2, 19), 'pdf-t2-19');
  assert.equal(legacyId(3, '7'), 'pdf-t3-7');
  assert.equal(legacyId(1, 'bank-t1-004'), 'bank-t1-004');
});

test('choose skips used prompts and returns null when none are left', async () => {
  const { choose } = await C();
  const pool = [{ id: 'a' }, { id: 'b' }];
  assert.equal(choose(pool, new Set(['a']))?.id, 'b');
  assert.equal(choose(pool, new Set(['a', 'b'])), null);
});

test('labels say where a prompt came from', async () => {
  const { consigneLabel } = await C();
  assert.equal(consigneLabel('bank-t1-004'), 'Bank #4');
  assert.equal(consigneLabel('pdf-t2-19'), 'pdf #19');
  assert.match(consigneLabel('ai-1234'), /AI-generated/);
  assert.match(consigneLabel('own-1234'), /Your prompt/);
});

test('the bank ships valid, unique prompts for the three tâches', async () => {
  const { bankItems } = await C();
  for (const t of [1, 2, 3] as const) {
    const items = bankItems(t);
    assert.ok(items.length >= 20, `tâche ${t} has ${items.length} prompts`);
    assert.equal(new Set(items.map((i) => i.id)).size, items.length);
    for (const i of items) {
      assert.match(i.id, new RegExp(`^bank-t${t}-\\d{3}$`));
      const c = i.content as Record<string, string>;
      if (t === 3) for (const k of ['titre', 'doc1', 'doc2']) assert.ok(c[k]?.trim().length > 10, `${i.id}.${k}`);
      else assert.ok(c.texte?.trim().length > 40, `${i.id}.texte`);
    }
  }
});

test('importing a pack adds prompts, skips duplicates and reports bad items', async () => {
  const { importConsignes, resolve } = await C();
  const pack = { version: 1, kind: 'consignes', prefix: 'pdf', items: [
    { tache: 1, num: 5, texte: 'Écrivez un message à un ami pour lui proposer une sortie au cinéma samedi soir.' },
    { tache: 3, num: 2, titre: 'Le vélo en ville', doc1: 'Document un assez long pour passer.', doc2: 'Document deux assez long pour passer.' },
    { tache: 4, num: 1, texte: 'x' },
  ] };
  const r = await importConsignes(pack);
  assert.deepEqual(r, { added: 2, skipped: 0, problems: ['item 3: tache must be 1, 2 or 3'] });
  assert.deepEqual(await importConsignes(pack), { added: 0, skipped: 2, problems: ['item 3: tache must be 1, 2 or 3'] });
  assert.equal(((await resolve(1, 'pdf-t1-5'))?.content as { texte: string }).texte.slice(0, 9), 'Écrivez u');
  assert.equal(await resolve(1, 'pdf-t1-999'), null);
});

test('a wrong pack shape is refused with a message', async () => {
  const { importConsignes } = await C();
  assert.deepEqual(await importConsignes({ version: 1, cards: [] }), { error: 'Invalid format: expected { "version": 1, "kind": "consignes", "prefix": "…", "items": [...] }.' });
  assert.match(((await importConsignes({ version: 1, kind: 'consignes', prefix: 'ai', items: [] })) as { error: string }).error, /prefix/);
});

test('remaining counts bank and pack prompts minus used ones', async () => {
  const { remaining, markUsed, bankItems } = await C();
  const before = await remaining();
  assert.equal(before.t1, bankItems(1).length + 1); // + the imported pdf-t1-5
  await markUsed({ t1: 'pdf-t1-5', t2: bankItems(2)[0].id, t3: bankItems(3)[0].id }, 1);
  const after = await remaining();
  assert.deepEqual(after, { t1: before.t1 - 1, t2: before.t2 - 1, t3: before.t3 - 1 });
});

test('prompts recorded by older versions (consignes_used) still count as used', async () => {
  const { sql } = await import('../../lib/db');
  const { usedIds } = await C();
  await sql('INSERT INTO consignes_used (tache, num, session_id) VALUES (2, 19, NULL)');
  (globalThis as { __tcfReady?: unknown }).__tcfReady = undefined; // reboot: the copy runs on init
  assert.ok((await usedIds()).has('pdf-t2-19'));
});

test('pickOne asks for a new prompt when every one has been used', async () => {
  const { pickOne, bankItems, addConsigne, pool } = await C();
  const { sql } = await import('../../lib/db');
  process.env.CONSIGNES_BANK_LIMIT = '1';
  assert.equal(bankItems(2).length, 1);
  for (const c of await pool(2)) await sql('INSERT INTO consigne_uses (id, tache) VALUES ($1, 2) ON CONFLICT DO NOTHING', [c.id]);
  let asked = 0;
  const made = await pickOne(2, async () => { asked++; return addConsigne(2, 'ai', { texte: 'Racontez une fête de quartier à laquelle vous avez participé. Donnez vos impressions.' }); });
  assert.equal(asked, 1);
  assert.match(made.id, /^ai-/);
  // an AI prompt that was drawn but never submitted is reused before generating another one
  const again = await pickOne(2, async () => { throw new Error('should not generate'); });
  assert.equal(again.id, made.id);
  delete process.env.CONSIGNES_BANK_LIMIT;
});

test('pasted prompts are stored but never drawn', async () => {
  const { addConsigne, pool } = await C();
  const own = await addConsigne(1, 'own', { texte: 'Vous écrivez à votre propriétaire pour signaler une fuite d’eau dans la salle de bain.' });
  assert.match(own.id, /^own-/);
  assert.ok(!(await pool(1)).some((c) => c.id === own.id));
});

test('a numbered prompt file becomes an importable pack', async () => {
  const { packFromNumbered, importConsignes } = await C();
  const pack = packFromNumbered({
    t1: { 3: 'Écrivez un message à votre voisine pour lui emprunter une échelle ce week-end.' },
    t2: {},
    t3: { 9: { titre: 'Faut-il un jardin en ville ?', doc1: 'Un premier document assez long.', doc2: 'Un second document assez long.' } },
  }, 'book');
  assert.deepEqual(pack.items.map((i) => `${i.tache}-${i.num}`), ['1-3', '3-9']);
  assert.deepEqual(await importConsignes(pack), { added: 2, skipped: 0, problems: [] });
});

test('a pack with too many prompts is refused', async () => {
  const { importConsignes } = await C();
  const items = Array.from({ length: 5001 }, (_, i) => ({ tache: 1, num: i + 1, texte: 'x'.repeat(50) }));
  assert.match(((await importConsignes({ version: 1, kind: 'consignes', prefix: 'big', items })) as { error: string }).error, /at most 5000/);
});
