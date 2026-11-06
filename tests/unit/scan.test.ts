import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findProblems } from '../../scripts/scan';

test('flags API keys, database URLs and private keys', () => {
  // built from pieces so this file doesn't trip secret scanners itself
  const fake = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';
  const text = [
    `const k = "sk-${'ant'}-api03-${fake}";`,
    `OPENAI_API_KEY=sk-${'proj'}-${fake}`,
    `DATABASE_URL=postgres${'ql'}://user:hunter2@ep-cool-123.neon.tech/db`,
    `-----BEGIN RSA ${'PRIVATE'} KEY-----`,
  ].join('\n');
  assert.deepEqual(findProblems(text, []).map((p) => p.what), ['Anthropic key', 'OpenAI key', 'database URL with password', 'private key']);
});

test('flags personal terms, case-insensitively, with the line number', () => {
  assert.deepEqual(findProblems('hello\nMy name is Jane Doe', ['jane doe']), [{ line: 2, what: 'personal term "jane doe"' }]);
});

test('test placeholders and empty examples are fine', () => {
  const ok = ['SESSION_SECRET=', "KEYS = { anthropic: 'sk-ant-e2e-valid-key' }", 'placeholder="sk-ant-…"', 'ANTHROPIC_BASE_URL=http://localhost:4999'].join('\n');
  assert.deepEqual(findProblems(ok, []), []);
});
