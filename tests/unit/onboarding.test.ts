// First-run setup: steps, tips and personal settings (timezone, NCLC target).
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

before(() => {
  process.env.PGLITE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tcf-unit-onb-'));
  delete process.env.DATABASE_URL;
  process.env.LEGACY_DIR = path.join(os.tmpdir(), 'tcf-no-legacy');
});

const O = () => import('../../lib/onboarding');
const reboot = () => { (globalThis as { __tcfReady?: unknown }).__tcfReady = undefined; };

test('steps go claude → openai → start → done', async () => {
  const { nextStep } = await O();
  assert.equal(nextStep('claude'), 'openai');
  assert.equal(nextStep('openai'), 'start');
  assert.equal(nextStep('start'), 'done');
  assert.equal(nextStep('done'), 'done');
});

test('a fresh install starts at the Claude step with tips on and NCLC 7', async () => {
  const { readOnboarding } = await O();
  const o = await readOnboarding();
  assert.equal(o.step, 'claude');
  assert.deepEqual(o.tipsDismissed, []);
  assert.equal(o.target.nclc, 7);
  assert.deepEqual([o.target.min, o.target.max], [10, 11]);
});

test('advancing never goes back, and done stays done', async () => {
  const { advance, readOnboarding } = await O();
  await advance('claude');
  assert.equal((await readOnboarding()).step, 'openai');
  await advance('claude'); // reopening an earlier page of the guide must not move the step back
  assert.equal((await readOnboarding()).step, 'openai');
  await advance('start');
  assert.equal((await readOnboarding()).step, 'done');
  await advance('claude');
  assert.equal((await readOnboarding()).step, 'done');
});

test('tips can be dismissed one by one and shown again', async () => {
  const { dismissTip, resetTips, readOnboarding, tipVisible } = await O();
  await dismissTip('written');
  await dismissTip('written');
  let o = await readOnboarding();
  assert.deepEqual(o.tipsDismissed, ['written']);
  assert.ok(!tipVisible(o, 'written'));
  assert.ok(tipVisible(o, 'oral'));
  await resetTips();
  o = await readOnboarding();
  assert.ok(tipVisible(o, 'written'));
});

test('the NCLC target maps to the official score band', async () => {
  const { setTarget, readOnboarding, targetFor } = await O();
  assert.deepEqual(targetFor(5), { nclc: 5, min: 6, max: 6 });
  assert.deepEqual(targetFor(9), { nclc: 9, min: 14, max: 15 });
  assert.deepEqual(targetFor(10), { nclc: 10, min: 16, max: 20 });
  await setTarget(8);
  assert.deepEqual((await readOnboarding()).target, { nclc: 8, min: 12, max: 13 });
  await assert.rejects(setTarget(12), /between 4 and 10/);
});

test('only valid IANA timezones are saved', async () => {
  const { setTimezone, readOnboarding } = await O();
  await setTimezone('America/Vancouver');
  assert.equal((await readOnboarding()).timezone, 'America/Vancouver');
  await assert.rejects(setTimezone('Mars/Olympus'), /timezone/);
});

test('an install that was already in use skips the guide and the tips', async () => {
  // simulate an existing install from before the guide: a password, and the guide marker not set yet
  const { sql } = await import('../../lib/db');
  await sql(`DELETE FROM settings WHERE key IN ('onboarding_init', 'onboarding_step', 'tips_dismissed')`);
  await sql(`INSERT INTO settings (key, value) VALUES ('password_hash', 'x:y') ON CONFLICT (key) DO NOTHING`);
  reboot();
  const { readOnboarding, tipVisible } = await O();
  const o = await readOnboarding();
  assert.equal(o.step, 'done');
  assert.ok(!tipVisible(o, 'written'));
});
