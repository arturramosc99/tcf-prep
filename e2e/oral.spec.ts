import { expect, test, type Page } from '@playwright/test';
import { correctedSession, saveKeys } from './helpers';

/** Replaces the microphone: a silent synthetic stream (works headless, on any OS), or a refusal. */
async function fakeMicrophone(page: Page, allow: boolean) {
  await page.addInitScript((ok) => {
    navigator.mediaDevices.getUserMedia = async () => {
      if (!ok) throw new DOMException('denied', 'NotAllowedError');
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      ctx.createOscillator().connect(dest);
      return dest.stream;
    };
  }, allow);
}

test.beforeEach(async ({ page }) => { await saveKeys(page.request); });

test('topics come from Claude and can be regenerated', async ({ page }) => {
  await page.goto('/oral');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const start = page.getByRole('button', { name: 'Allow microphone and start' });
  await expect(start).toBeEnabled();
  await page.getByRole('button', { name: 'Generate other topics' }).click();
  await expect(start).toBeEnabled();
});

test('a refused microphone shows how to fix it', async ({ page }) => {
  await fakeMicrophone(page, false);
  await page.goto('/oral');
  await page.getByRole('button', { name: 'Allow microphone and start' }).click();
  await expect(page.locator('.error-box')).toContainText('No microphone access');
});

test('a voice connection failure goes back to the start with a message', async ({ page }) => {
  await fakeMicrophone(page, true);
  await page.route('https://api.openai.com/v1/realtime/calls', (r) => r.fulfill({ status: 500, body: 'nope' }));
  await page.goto('/oral');
  await page.getByRole('button', { name: 'Allow microphone and start' }).click();
  await expect(page.locator('.error-box')).toContainText('Could not connect the voice (500)');
  await expect(page.getByRole('button', { name: 'Allow microphone and start' })).toBeVisible();
});

test('an Oral session shows the transcript and the rephrasings', async ({ page }) => {
  const id = await correctedSession(page.request, 'eo');
  await page.goto(`/session/${id}`);
  await expect(page.locator('.big').first()).toHaveText('10.5');
  await expect(page.getByRole('columnheader', { name: 'You said' })).toBeVisible();
  await page.getByText('Transcript').first().click();
  await expect(page.getByText('les journées sont long').first()).toBeVisible();
});
