// Errors, History and the correction failure path.
import { expect, test } from '@playwright/test';
import { correctedSession, mockMode, saveKeys } from './helpers';

test.beforeEach(async ({ page }) => { await saveKeys(page.request); });
test.afterEach(async () => { await mockMode('ok'); });

test('Errors shows English status labels and exports English markdown', async ({ page }) => {
  await correctedSession(page.request, 'ee');
  await page.goto('/errors');
  for (const label of ['Critical', 'Active', 'Watching', 'Under control', 'Resolved']) await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  const md = await (await page.request.get('/api/export')).text();
  expect(md).toMatch(/^# Recurring errors — exported from TCF Prep on \d{4}-\d{2}-\d{2}/);
  expect(md).toContain('occurrence(s)');
});

test('History lists sessions and opens one', async ({ page }) => {
  await correctedSession(page.request, 'ee');
  await page.goto('/history');
  await expect(page.getByRole('columnheader', { name: 'Score' })).toBeVisible();
  await page.getByRole('link', { name: 'Open' }).first().click();
  await expect(page).toHaveURL(/\/session\/\d+$/);
});

test('a rejected Claude key shows the error, and "Correct again" recovers', async ({ page }) => {
  const id = await correctedSession(page.request, 'ee', () => mockMode('401'));
  await page.goto(`/session/${id}`);
  await expect(page.getByRole('heading', { name: 'The correction did not run' })).toBeVisible();
  await expect(page.locator('.error-box')).toContainText('Your Claude key was rejected');
  await mockMode('ok');
  await page.getByRole('button', { name: 'Correct again' }).click();
  await expect(page.locator('.big').first()).toHaveText('09.5', { timeout: 30_000 });
});

test('an unknown session shows a message', async ({ page }) => {
  await page.goto('/session/999999');
  await expect(page.locator('.error-box')).toContainText('Session not found.');
});

test('a malformed session id is a clean 404, not a server error', async ({ page }) => {
  for (const r of [await page.request.get('/api/sessions/abc'), await page.request.post('/api/sessions/abc/retry')]) {
    expect(r.status()).toBe(404);
    expect((await r.json()).error).toBe('Session not found.');
  }
});
