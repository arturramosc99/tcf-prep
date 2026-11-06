// Motion: page changes animate, waits show something moving, and "reduce motion" turns it all off.
import { expect, test, type Page } from '@playwright/test';
import { correctedSession, KEYS, saveKeys } from './helpers';

test.beforeEach(async ({ page }) => { await saveKeys(page.request); });

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Counts the browser view transitions the page starts (React runs one per animated navigation). */
async function countViewTransitions(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __vt: number };
    w.__vt = 0;
    const start = document.startViewTransition?.bind(document);
    if (start) document.startViewTransition = ((arg: never) => { w.__vt++; return start(arg); }) as typeof document.startViewTransition;
  });
  return () => page.evaluate(() => (window as unknown as { __vt: number }).__vt);
}

/** Holds navigation requests (not prefetches) for a moment, as a slow server would. */
async function slowNavigation(page: Page, ms = 1500) {
  await page.route(/[?&]_rsc=/, async (route) => {
    if (!route.request().headers()['next-router-prefetch']) await wait(ms);
    await route.continue();
  });
}

/** Shows a session as if its correction were still running. */
async function stillCorrecting(page: Page, id: number) {
  await page.route(`**/api/sessions/${id}`, async (route) => {
    const r = await route.fetch();
    await route.fulfill({ response: r, json: { ...(await r.json()), status: 'correcting', correction: null } });
  });
}

test('moving between pages is animated, not a cut', async ({ page }) => {
  const started = await countViewTransitions(page);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'History' }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect.poll(started).toBeGreaterThan(0);
});

test('a slow page shows a placeholder right away', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle'); // links prefetched
  await slowNavigation(page);
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Errors' }).click();
  await expect(page.locator('[aria-busy="true"] .sk').first()).toBeVisible();
  await expect(page).toHaveURL(/\/errors$/);
  await expect(page.locator('.sk')).toHaveCount(0);
});

test('a running correction shows the working dial and the time spent', async ({ page, request }) => {
  const id = await correctedSession(request, 'ee');
  await stillCorrecting(page, id);
  await page.goto(`/session/${id}`);
  await expect(page.getByRole('heading', { name: 'Correction in progress' })).toBeVisible();
  const dial = page.getByRole('progressbar', { name: 'Correction in progress' });
  await expect(dial).toBeVisible();
  await expect(dial).toContainText(/00:0\d/);
  const anim = await dial.locator('line').first().evaluate((l) => getComputedStyle(l).animationName);
  expect(anim).toBe('dial-sweep');
});

test('drawing prompts shows the working dial in place of the timer', async ({ page }) => {
  await page.route('**/api/ee/draw*', async (route) => { await wait(1500); await route.continue(); });
  await page.goto('/written');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('progressbar', { name: 'Drawing prompts' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start the exam' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('a button that is waiting on the server shows a spinner', async ({ page }) => {
  await page.route('**/api/keys', async (route) => { await wait(1500); await route.continue(); });
  await page.goto('/settings');
  const input = page.locator('input[name=anthropic-key]');
  const card = input.locator('xpath=ancestor::section');
  await input.fill(KEYS.anthropic);
  await card.getByRole('button', { name: 'Test and save' }).click();
  const busy = card.locator('button[aria-busy="true"]');
  await expect(busy).toHaveText('Testing…');
  expect(await busy.evaluate((b) => getComputedStyle(b, '::before').animationName)).toBe('spin');
  await expect(card.getByRole('status')).toHaveText('Key tested and saved.');
});

test('with "reduce motion" on, nothing moves', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const id = await correctedSession(request, 'ee');
  await stillCorrecting(page, id);
  await page.goto(`/session/${id}`);
  const dial = page.getByRole('progressbar', { name: 'Correction in progress' });
  await expect(dial).toBeVisible();
  expect(await dial.locator('line').first().evaluate((l) => getComputedStyle(l).animationName)).toBe('none');
});
