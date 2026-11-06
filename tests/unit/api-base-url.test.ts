// External API URLs come from env so tests (and proxies) can point them elsewhere.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { startStub, type Stub } from './stub';

let stub: Stub;
before(async () => {
  stub = await startStub((req, res) => {
    const ok = req.headers['x-api-key'] === 'good' || req.headers.authorization === 'Bearer good';
    res.writeHead(ok ? 200 : 401, { 'content-type': 'application/json' });
    res.end(JSON.stringify(ok ? { data: [] } : { error: { message: 'stub says no' } }));
  });
  process.env.ANTHROPIC_BASE_URL = stub.url;
  process.env.OPENAI_BASE_URL = `${stub.url}/openai/v1`;
});
after(() => stub.close());

test('testKey(anthropic) calls ANTHROPIC_BASE_URL/v1/models', async () => {
  const { testKey } = await import('../../lib/settings');
  assert.equal(await testKey('anthropic', 'good'), null);
  assert.deepEqual(stub.paths.at(-1), 'GET /v1/models?limit=1');
});

test('testKey(anthropic) returns the provider error message for a bad key', async () => {
  const { testKey } = await import('../../lib/settings');
  assert.equal(await testKey('anthropic', 'bad'), 'stub says no');
});

test('testKey(openai) calls OPENAI_BASE_URL/models', async () => {
  const { testKey } = await import('../../lib/settings');
  assert.equal(await testKey('openai', 'good'), null);
  assert.deepEqual(stub.paths.at(-1), 'GET /openai/v1/models');
});
