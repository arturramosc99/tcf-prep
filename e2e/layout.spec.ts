// Runs in every size × color scheme (see the layout-* projects in playwright.config.ts).
import { expect, test } from '@playwright/test';
import { correctedSession, expectNoHorizontalScroll, STATE, watchConsole } from './helpers';

// some corrected sessions, so the pages show patterns, pills and cards (not just empty states)
test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: STATE });
  await correctedSession(ctx.request, 'ee');
  await correctedSession(ctx.request, 'ee');
  await ctx.close();
});

/** Number of text lines an element's content takes. */
const lineCount = (el: Element) => {
  const r = document.createRange();
  r.selectNodeContents(el);
  return new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size;
};

const PAGES = ['/', '/written', '/oral', '/flashcards', '/flashcards/practice', '/history', '/errors', '/settings', '/setup/claude', '/setup/openai', '/setup/start', '/welcome?replay=1'];

for (const path of PAGES) {
  test(`${path} fits the screen without errors`, async ({ page }, info) => {
    const errors = watchConsole(page);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main')).toBeVisible();
    await expectNoHorizontalScroll(page);
    // saved for visual review (docs/qa/README.md): test-results/screens/<project>/<page>.png
    const shot = await page.screenshot({ fullPage: true, path: `test-results/screens/${info.project.name}/${path === '/' ? 'home' : path.slice(1).replace(/[^a-z0-9]+/g, '-')}.png` });
    await info.attach('screen', { body: shot, contentType: 'image/png' });
    expect(errors).toEqual([]);
  });
}

test('/login fits the screen', async ({ browser }) => {
  const page = await browser.newPage({ storageState: { cookies: [], origins: [] } });
  await page.goto('/login');
  await expectNoHorizontalScroll(page);
  await page.close();
});

test('every section of the navigation is visible without scrolling it', async ({ page }) => {
  await page.goto('/history');
  const width = page.viewportSize()!.width;
  for (const link of await page.getByRole('navigation', { name: 'Sections' }).getByRole('link').all()) {
    const box = (await link.boundingBox())!;
    expect(box.x + box.width, `${await link.textContent()} is cut off`).toBeLessThanOrEqual(width);
  }
});

test('the Written start table keeps words whole', async ({ page }) => {
  await page.goto('/written');
  for (const t of ['Tâche 1', 'Tâche 2', 'Tâche 3']) {
    const lines = await page.getByRole('cell', { name: t, exact: true }).evaluate((el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
    });
    expect(lines, `"${t}" wraps`).toBe(1);
  }
});

test('status pills and buttons never break onto two lines', async ({ page }) => {
  for (const path of ['/', '/flashcards', '/errors']) {
    await page.goto(path);
    for (const el of await page.locator('main .toggle span, main .btn').all()) {
      if (!(await el.isVisible())) continue;
      expect(await el.evaluate(lineCount), `${path}: "${await el.textContent()}" wraps`).toBe(1);
    }
  }
});

test('a status pill sits level with the button next to it', async ({ page }) => {
  await page.goto('/flashcards');
  const row = page.getByRole('row').filter({ has: page.locator('.toggle') }).first();
  const pill = (await row.locator('.toggle').boundingBox())!;
  const btn = (await row.locator('.btn').boundingBox())!;
  expect(Math.abs(pill.y + pill.height / 2 - (btn.y + btn.height / 2))).toBeLessThanOrEqual(3);
});

test('select arrows sit inside the rounded field, not on its edge', async ({ page }) => {
  await page.goto('/settings');
  for (const sel of await page.locator('main select').all()) {
    const s = await sel.evaluate((el) => { const c = getComputedStyle(el); return { appearance: c.appearance, pad: parseFloat(c.paddingRight) }; });
    expect(s.appearance).toBe('none'); // our own chevron, placed with room to spare
    expect(s.pad).toBeGreaterThanOrEqual(40);
  }
});
