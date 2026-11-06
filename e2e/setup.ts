// Runs once before the other projects: a brand-new install goes through the setup guide.
// The logged-in session is saved for the other tests.
import { expect, test as setup } from '@playwright/test';
import { KEYS, PASSWORD, saveKeys, STATE } from './helpers';

setup('first visit: welcome, password, Claude, OpenAI, tour', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  for (const [name, width, height] of [['mobile', 375, 812], ['desktop', 1280, 800]] as const) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ fullPage: true, path: `test-results/screens/welcome-${name}.png` });
  }

  // password: too short, then mismatch, then right
  await page.locator('input[name=password]').fill('short');
  await page.locator('input[name=confirm]').fill('short');
  await page.locator('button[type=submit]').click();
  await expect(page.locator('input[name=password]:invalid')).toHaveCount(1); // minLength=10
  await page.locator('input[name=password]').fill(PASSWORD);
  await page.locator('input[name=confirm]').fill(`${PASSWORD}x`);
  await page.locator('button[type=submit]').click();
  await expect(page.locator('.error-box[role=alert]')).toContainText("don't match");
  await page.locator('input[name=confirm]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();

  // Claude step: survives a reload, and the rest of the app waits for the guide
  await expect(page).toHaveURL(/\/setup\/claude$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Connect Claude' })).toBeVisible();
  await page.goto('/history');
  await expect(page).toHaveURL(/\/setup\/claude$/);
  await page.locator('input[name=anthropic-key]').fill('sk-ant-wrong');
  await page.getByRole('button', { name: 'Test and save' }).click();
  await expect(page.locator('.error-box')).toBeVisible();
  await page.locator('input[name=anthropic-key]').fill(KEYS.anthropic);
  await page.getByRole('button', { name: 'Test and save' }).click();
  await expect(page.locator('.toggle.on')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // OpenAI step: skipping is allowed
  await expect(page).toHaveURL(/\/setup\/openai$/);
  await page.getByRole('button', { name: 'Skip for now' }).click();

  // tour
  await expect(page).toHaveURL(/\/setup\/start$/);
  await page.getByRole('button', { name: 'Go to the dashboard' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('complementary', { name: 'Tip' })).toBeVisible();
  await expect(page.getByText('Not connected yet: OpenAI')).toBeVisible();

  await saveKeys(page.request);
  await page.context().storageState({ path: STATE });
});
