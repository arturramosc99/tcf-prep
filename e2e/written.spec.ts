import { expect, test } from '@playwright/test';
import { saveKeys } from './helpers';

test.beforeEach(async ({ page }) => { await saveKeys(page.request); });

test('a full Written simulation: draft survives a reload, then gets corrected', async ({ page }) => {
  await page.goto('/written');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Expression écrite · 60 minutes' })).toBeVisible();
  await page.getByRole('button', { name: 'Start the exam' }).click();
  await expect(page.getByRole('tab', { name: /Tâche 1/ })).toHaveAttribute('aria-selected', 'true');

  const t1 = page.locator('textarea#t1');
  await t1.fill('Salut Marie, je t’attends a la gare samedi');
  await page.getByRole('button', { name: 'é', exact: true }).click();
  await expect(t1).toHaveValue(/samediê?é$/);
  await expect(page.getByText(/\d+ to go/)).toBeVisible();

  await page.reload();
  await expect(page.locator('textarea#t1')).toHaveValue(/^Salut Marie/);

  await page.getByRole('tab', { name: /Tâche 3/ }).click();
  await expect(page.getByText('Document 1')).toBeVisible();

  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('dialog')).toContainText('Outside the limit or incomplete');
  await page.getByRole('button', { name: 'Send for correction' }).click();
  await expect(page).toHaveURL(/\/session\/\d+$/);
  await expect(page.locator('.big').first()).toHaveText('09.5', { timeout: 30_000 });
  await expect(page.getByRole('table', { name: 'Errors' }).first()).toContainText('Je t\'attends à la gare');
  await expect(page.getByText('B2+ version of your text').first()).toBeVisible();

  await page.goto('/errors');
  await expect(page.getByText('Missing accent on the preposition à')).toBeVisible();
  await page.goto('/history');
  await expect(page.getByRole('link', { name: 'Open' }).first()).toBeVisible();
});

test('old Portuguese routes redirect to the English ones', async ({ page }) => {
  for (const [from, to] of [['/ecrite', '/written'], ['/cartes/treino', '/flashcards/practice'], ['/config', '/settings']]) {
    await page.goto(from);
    await expect(page).toHaveURL(new RegExp(`${to}$`));
  }
});
