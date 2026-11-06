// Screenshots for the README and docs, from synthetic data: npm run screenshots → docs/screenshots/*.png
import { test } from '@playwright/test';
import { correctedSession, saveKeys } from './helpers';

test('README screenshots', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // still frames: no page transition or card slide mid-way
  await saveKeys(page.request);
  for (const id of ['home', 'written', 'oral', 'flashcards', 'errors', 'history']) {
    await page.request.post('/api/onboarding', { data: { dismissTip: id } });
  }
  await correctedSession(page.request, 'ee');
  await correctedSession(page.request, 'eo');
  const written = await correctedSession(page.request, 'ee');

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.screenshot({ path: 'docs/screenshots/dashboard-desktop.png' });
  await page.goto('/errors');
  await page.screenshot({ path: 'docs/screenshots/errors-desktop.png' });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/session/${written}`);
  await page.locator('.big').first().waitFor();
  await page.screenshot({ path: 'docs/screenshots/session-mobile.png' });
  await page.goto('/flashcards/practice?pattern=qui-que');
  await page.locator('.choice').first().waitFor();
  await page.screenshot({ path: 'docs/screenshots/flashcard-mobile.png' });
});
