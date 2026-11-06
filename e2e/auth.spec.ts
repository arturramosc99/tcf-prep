import { expect, test } from '@playwright/test';
import { PASSWORD } from './helpers';

const PAGES = ['/setup/claude', '/setup/start', '/', '/written', '/oral', '/flashcards', '/flashcards/practice', '/history', '/errors', '/settings', '/session/1'];
const APIS: [string, string][] = [
  ['GET', '/api/keys'], ['POST', '/api/keys'], ['GET', '/api/ee/draw'], ['POST', '/api/eo/topics'], ['POST', '/api/eo/token'],
  ['POST', '/api/sessions'], ['GET', '/api/sessions/1'], ['POST', '/api/sessions/1/retry'], ['GET', '/api/export'],
  ['POST', '/api/onboarding'], ['GET', '/api/translate'], ['POST', '/api/translate'], ['POST', '/api/ee/custom'], ['POST', '/api/consignes/import'], ['GET', '/api/cards'], ['PATCH', '/api/cards/1'], ['POST', '/api/cards/1/answer'], ['POST', '/api/cards/import'],
];

test.describe('logged out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const path of PAGES) {
    test(`page ${path} redirects to /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  for (const [method, path] of APIS) {
    test(`API ${method} ${path} answers 401 JSON`, async ({ request }) => {
      const r = await request.fetch(path, { method, data: method === 'GET' ? undefined : {} });
      expect(r.status()).toBe(401);
      expect((await r.json()).error).toBeTruthy();
    });
  }

  test('/welcome sends to /login once a password exists', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('wrong password shows an error, right password logs in', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name=password]').fill('not-the-password');
    await page.locator('button[type=submit]').click();
    await expect(page.locator('.error-box[role=alert]')).toBeVisible();
    await page.locator('input[name=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await expect(page).toHaveURL(/\/$/);
  });
});
