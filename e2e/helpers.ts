import fs from 'node:fs';
import path from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';

/** Test-only password for the throwaway e2e database. Not a secret. */
export const PASSWORD = 'e2e-password-for-tests';
export const MOCK = 'http://localhost:4999';
export const STATE = 'e2e/.auth/state.json';

/** Anthropic/OpenAI keys the mock accepts. */
export const KEYS = { anthropic: 'sk-ant-e2e-valid-key', openai: 'sk-e2e-valid-key' };

export async function mockMode(mode: 'ok' | '401' | '429' | '400') {
  await fetch(`${MOCK}/__control`, { method: 'POST', body: JSON.stringify({ mode }) });
}

/** The page must never scroll sideways (mobile invariant). */
export async function expectNoHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth,
  }));
  expect(scroll, 'page scrolls horizontally').toBeLessThanOrEqual(client);
}

/**
 * Waits until React has attached its handlers to an element. Pages stream in (loading.tsx), so their HTML can be on
 * screen a moment before it reacts; a `change` event fired in that moment (file pick, select) is not replayed.
 */
export async function hydrated(l: Locator) {
  await expect.poll(() => l.evaluate((el) => Object.keys(el).some((k) => k.startsWith('__reactProps')))).toBe(true);
}

/** Collects console errors and uncaught exceptions while a page is used. */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

type Request = import('@playwright/test').APIRequestContext;

/** Saves the keys the mock accepts (the request shares the logged-in cookies). */
export async function saveKeys(request: Request) {
  for (const provider of ['anthropic', 'openai'] as const) {
    const r = await request.post('/api/keys', { data: { provider, key: KEYS[provider] } });
    expect(r.ok(), await r.text()).toBeTruthy();
  }
}

const TRANSCRIPT = {
  t1: [
    { who: 'examinateur', t: 1, text: 'Bonjour. Pouvez-vous vous présenter, s’il vous plaît ?' },
    { who: 'candidat', t: 5, text: 'Je m’appelle Alex, je travaille dans une boulangerie et les journées sont long.' },
  ],
  t2: [{ who: 'candidat', t: 2, text: 'Bonjour, quels sont les horaires de l’atelier ?' }, { who: 'examinateur', t: 6, text: 'Le mardi et le jeudi soir.' }],
  t3: [{ who: 'candidat', t: 3, text: 'À mon avis, il faut limiter les voitures en ville.' }],
};

/** Submits a session through the API and waits until the mock correction is done. Returns its id. */
export async function correctedSession(request: Request, kind: 'ee' | 'eo', beforeSubmit?: () => Promise<void>) {
  let payload: object;
  if (kind === 'ee') {
    const draw = await (await request.post('/api/ee/draw')).json();
    payload = { ids: draw.ids, textes: { t1: 'Salut Marie, je t’attends a la gare.', t2: 'J’ai vu les gens qui je connais.', t3p1: 'Les deux documents.', t3p2: 'À mon avis…' } };
  } else {
    const topics = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'topics.json'), 'utf8'));
    payload = { topics, transcript: TRANSCRIPT, durations: { t1: 120, t2: 210, t3: 270 } };
  }
  await beforeSubmit?.();
  const r = await request.post('/api/sessions', { data: { kind, key: `e2e-${Date.now()}-${Math.random()}`, minutes: kind === 'ee' ? 42 : 12, payload } });
  expect(r.ok(), await r.text()).toBeTruthy();
  const { id } = await r.json();
  await expect.poll(async () => (await (await request.get(`/api/sessions/${id}`)).json()).status, { timeout: 30_000 }).not.toBe('correcting');
  return id as number;
}
