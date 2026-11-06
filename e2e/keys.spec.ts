import { expect, test } from '@playwright/test';
import { KEYS } from './helpers';

for (const provider of ['anthropic', 'openai'] as const) {
  test(`${provider} key is tested before saving`, async ({ page }) => {
    await page.goto('/settings');
    const input = page.locator(`input[name=${provider}-key]`);
    const form = input.locator('xpath=ancestor::form');
    const card = form.locator('xpath=ancestor::section');

    await input.fill(provider === 'anthropic' ? 'sk-ant-wrong' : 'sk-wrong');
    await form.locator('button[type=submit]').click();
    await expect(card.locator('.error-box')).toBeVisible();

    await input.fill(KEYS[provider]);
    await form.locator('button[type=submit]').click();
    await expect(card.locator('.toggle.on')).toBeVisible();
    await expect(card.locator('.error-box')).toHaveCount(0);
  });
}
