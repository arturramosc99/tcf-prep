import { expect, test } from '@playwright/test';
import { correctedSession, hydrated, saveKeys } from './helpers';

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: 'e2e/.auth/state.json' });
  await saveKeys(page.request);
  await correctedSession(page.request, 'ee'); // creates the "accent-preposition-a" and "qui-que" patterns and their cards
  await page.close();
});

test('multiple choice: a wrong answer comes back at the end of the round', async ({ page }) => {
  await page.goto('/flashcards/practice?pattern=qui-que');
  await expect(page.getByText(/level \d\/5/)).toBeVisible();
  const wrong = page.locator('.choice').filter({ hasNotText: /^que$/ }).first();
  await wrong.click();
  await expect(page.getByRole('status')).toContainText('Wrong');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText(/· again/)).toBeVisible();
  await page.locator('.choice', { hasText: /^que$/ }).click();
  await expect(page.getByRole('status')).toContainText('Right');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Round complete' })).toBeVisible();
});

test('two right answers move a card to typing mode', async ({ page }) => {
  for (let i = 0; i < 2; i++) {
    await page.goto('/flashcards/practice?pattern=accent-preposition-a');
    await page.locator('.choice', { hasText: /^à$/ }).click();
    await expect(page.getByRole('status')).toContainText('Right');
  }
  await page.goto('/flashcards/practice?pattern=accent-preposition-a');
  await expect(page.getByText(/Type it · level 2\/5/)).toBeVisible();
  await page.getByLabel('Your answer').fill('a');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByRole('status')).toContainText('Wrong');
  await expect(page.getByRole('status')).toContainText('Right: à');
});

test('a card can be archived', async ({ page }) => {
  await page.goto('/flashcards/practice?pattern=qui-que');
  await page.locator('.choice').first().click();
  await page.getByRole('button', { name: 'Archive card' }).click();
  await page.goto('/flashcards/practice?pattern=qui-que');
  await expect(page.getByRole('heading', { name: 'No cards to practise right now' })).toBeVisible();
});

test('importing a card pack reports added cards and problems', async ({ page }) => {
  await page.goto('/settings');
  const pack = { version: 1, cards: [
    { kind: 'phrase', prompt: 'Je ___ au marché demain.', answer: 'vais', wrong: ['va', 'vas'], rule: 'aller, 1st person: je vais' },
    { kind: 'nope', prompt: 'x', answer: 'y', wrong: ['z'], rule: 'r' },
  ] };
  const card = page.locator('section', { hasText: 'Flashcard pack' });
  await hydrated(card.locator('input[type=file]'));
  await card.locator('input[type=file]').setInputFiles({ name: 'pack.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pack)) });
  await expect(card.getByRole('status')).toContainText('1 new cards, 0 already existed. 1 with problems');
  await card.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('not json') });
  await expect(card.getByRole('status')).toContainText('The file is not valid JSON.');
});
