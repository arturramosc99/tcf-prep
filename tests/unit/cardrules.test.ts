import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkImported, dedupKey, draftFromError, isFixPrompt, same } from '../../lib/cardrules';

test('a one-word spelling error becomes a "mot" card with an English hint', () => {
  const c = draftFromError('Je suis allé a la gare', 'Je suis allé à la gare', 'à takes an accent');
  assert.equal(c?.kind, 'mot');
  assert.equal(c?.hint, 'you wrote “a”');
  assert.equal(c?.answer, 'à');
});

test('a long rewrite becomes a "Fix:" card', () => {
  const c = draftFromError('je pense que il est important de faire ça', 'à mon avis, il est essentiel de le faire', 'register');
  assert.equal(c?.kind, 'phrase');
  assert.match(c!.prompt, /^Fix: «/);
});

test('isFixPrompt accepts the old Portuguese and the new English prefix', () => {
  assert.ok(isFixPrompt('Fix: «je vais»'));
  assert.ok(isFixPrompt('Corrija: «je vais»'));
  assert.ok(!isFixPrompt('Je ___ au travail'));
});

test('dedupKey treats "Corrija:" and "Fix:" cards as the same card', () => {
  const a = dedupKey({ kind: 'phrase', prompt: 'Corrija: «je vais»', answer: 'j’aille' });
  const b = dedupKey({ kind: 'phrase', prompt: 'Fix: «je vais»', answer: 'j’aille' });
  assert.equal(a, b);
});

test('imported "Fix:" phrase cards need no blank', () => {
  const card = { kind: 'phrase', prompt: 'Fix: «je vais au travail»', answer: 'je vais travailler', wrong: ['je va travailler'], rule: 'r' };
  assert.equal(checkImported(card), null);
});

test('imported cards are explained in English when invalid', () => {
  assert.equal(checkImported({ kind: 'x' }), 'kind must be "mot" or "phrase"');
});

test('English correction notes do not become cards', () => {
  assert.equal(draftFromError('pour finir', 'pour finir middle of the story', 'r'), null);
  assert.equal(draftFromError('je mange vite', 'je mange vite after the verb', 'r'), null);
});

test('accents always count when checking typed answers', () => {
  assert.ok(same('à la gare.', 'À la gare'));
  assert.ok(!same('a la gare', 'à la gare'));
});
