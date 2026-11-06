// Écrite prompts: the bank (limited to 1 per tâche in tests), Claude-written prompts, pasted prompts and packs.
import { expect, test } from '@playwright/test';
import { correctedSession, hydrated } from './helpers';

test('once the bank is used up, new prompts are written by Claude', async ({ page }) => {
  await correctedSession(page.request, 'ee'); // uses at least the one bank prompt per tâche
  const draw = await (await page.request.post('/api/ee/draw')).json();
  expect(Object.values(draw.labels)).toEqual(['AI-generated prompt', 'AI-generated prompt', 'AI-generated prompt']);
  expect(draw.t3.titre).toBe('Faut-il supprimer les devoirs à la maison ?');
});

test('a pasted prompt replaces the drawn one for this simulation', async ({ page }) => {
  await page.goto('/written');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('row', { name: /Tâche 2/ }).getByRole('button', { name: 'Use my own prompt' }).click();
  await page.locator('textarea[name=texte]').fill('Vous avez participé à un atelier de poterie. Racontez cette expérience à un ami.');
  await page.getByRole('button', { name: 'Use this prompt' }).click();
  await expect(page.getByRole('row', { name: /Tâche 2/ })).toContainText('Your prompt');
  await page.getByRole('button', { name: 'Start the exam' }).click();
  await page.getByRole('tab', { name: /Tâche 2/ }).click();
  await expect(page.locator('.consigne')).toHaveText(/atelier de poterie/);
});

test('an empty pasted prompt is refused', async ({ page }) => {
  const r = await page.request.post('/api/ee/custom', { data: { tache: 3, content: { titre: 'x', doc1: '', doc2: 'y' } } });
  expect(r.status()).toBe(400);
  expect((await r.json()).error).toContain('doc1 is empty');
});

test('a prompt pack can be imported in Settings', async ({ page }) => {
  await page.goto('/settings');
  const card = page.locator('section', { hasText: 'Prompt pack' });
  await hydrated(card.locator('input[type=file]'));
  const pack = { version: 1, kind: 'consignes', prefix: 'book', items: [
    { tache: 1, num: 1, texte: 'Écrivez à votre voisine pour lui emprunter une échelle ce week-end. (60 mots minimum / 120 mots maximum)' },
  ] };
  await card.locator('input[type=file]').setInputFiles({ name: 'prompts.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pack)) });
  await expect(card.getByRole('status')).toContainText('1 new prompts, 0 already existed.');
  await card.locator('input[type=file]').setInputFiles({ name: 'cards.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1,"cards":[]}') });
  await expect(card.getByRole('status')).toContainText('Invalid format');
});
