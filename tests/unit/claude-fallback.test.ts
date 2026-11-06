// Without a Claude key the app must not silently shell out to a local `claude` CLI
// (that would spend someone's subscription in tests). The CLI path is opt-in.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

before(() => {
  process.env.PGLITE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tcf-unit-'));
  delete process.env.DATABASE_URL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.VERCEL;
  delete process.env.CLAUDE_CLI_FALLBACK;
  process.env.LEGACY_DIR = path.join(os.tmpdir(), 'tcf-no-legacy');
  // a fake `claude` on PATH that would succeed if it were ever called
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'tcf-bin-'));
  fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\necho \'{"structured_output":{"ok":true}}\'\n', { mode: 0o755 });
  process.env.PATH = `${bin}:${process.env.PATH}`;
});

test('structured() without a key and without CLAUDE_CLI_FALLBACK asks for a key', async () => {
  const { structured } = await import('../../lib/claude');
  await assert.rejects(structured('x', { type: 'object' }, 's'), /Claude key/i);
});

test('structured() uses the CLI only when CLAUDE_CLI_FALLBACK=1', async () => {
  process.env.CLAUDE_CLI_FALLBACK = '1';
  const { structured } = await import('../../lib/claude');
  assert.deepEqual(await structured('x', { type: 'object' }, 's'), { ok: true });
  delete process.env.CLAUDE_CLI_FALLBACK;
});
