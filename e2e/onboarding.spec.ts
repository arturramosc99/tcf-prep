// After the first run: tips, reopening the guide, preferences.
import { expect, test } from '@playwright/test';
import { hydrated } from './helpers';

test('a page tip disappears once dismissed and comes back from Settings', async ({ page }) => {
  await page.goto('/history');
  const tip = page.getByRole('complementary', { name: 'Tip' });
  await expect(tip).toBeVisible();
  await tip.getByRole('button', { name: 'Got it' }).click();
  await expect(tip).toHaveCount(0);
  await page.reload();
  await expect(tip).toHaveCount(0);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Show page tips again' }).click();
  await expect(page.getByRole('status')).toContainText('Page tips will show again.');
  await page.goto('/history');
  await expect(page.getByRole('complementary', { name: 'Tip' })).toBeVisible();
});

test('the setup guide can be reopened without getting stuck in it', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Replay the setup guide' }).click();
  await page.getByRole('link', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/setup\/claude$/);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/setup\/openai$/);
  await page.goto('/history'); // the app is not locked behind the guide any more
  await expect(page).toHaveURL(/\/history$/);
});

test('the NCLC target changes what the dashboard compares against', async ({ page }) => {
  await page.goto('/settings');
  await hydrated(page.getByLabel('Your target'));
  await page.getByLabel('Your target').selectOption('8');
  await expect(page.getByRole('status')).toContainText('Target saved.');
  await page.goto('/');
  await expect(page.getByText('12–13 /20 (NCLC 8)').first()).toBeVisible();
  await page.goto('/settings');
  await hydrated(page.getByLabel('Your target'));
  await page.getByLabel('Your target').selectOption('7');
});

test('older Portuguese text can be translated to English from Settings', async ({ page }) => {
  const pack = { version: 1, cards: [{ kind: 'phrase', prompt: 'Nous ___ partis tôt.', answer: 'sommes', wrong: ['avons'], rule: 'Verbos de movimento usam être no passé composé.' }] };
  expect((await page.request.post('/api/cards/import', { data: pack })).ok()).toBeTruthy();
  await page.goto('/settings');
  const card = page.locator('section', { hasText: 'Older history in Portuguese' });
  await expect(card).toContainText('1 flashcards');
  await card.getByRole('button', { name: 'Translate to English' }).click();
  await expect(card.getByRole('status')).toContainText('Done: 1 texts translated.');
  await page.reload();
  await expect(page.getByText('Older history in Portuguese')).toHaveCount(0);
});

test('the whole first-run guide can be replayed from Settings without touching the password', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Replay the setup guide' }).click();

  // step 1: the same welcome screen a new user sees, with the password form shown but disabled
  await expect(page).toHaveURL(/\/welcome\?replay=1$/);
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await expect(page.locator('input[name=password]')).toBeDisabled();
  await page.getByRole('link', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/setup\/claude$/);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/setup\/openai$/);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/setup\/start$/);
  await page.getByRole('button', { name: 'Go to the dashboard' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('complementary', { name: 'Tip' })).toBeVisible(); // tips start over too
});

test('the replay welcome page is not reachable logged out', async ({ browser }) => {
  const page = await browser.newPage({ storageState: { cookies: [], origins: [] } });
  await page.goto('/welcome?replay=1');
  await expect(page).toHaveURL(/\/login$/);
  await page.close();
});
