// Fake Anthropic + OpenAI APIs for end-to-end tests: no network, no spend.
// Point the app at it with ANTHROPIC_BASE_URL=http://localhost:4999 and
// OPENAI_BASE_URL=http://localhost:4999/openai/v1 (playwright.config.ts does this).
//
// Keys: anything starting with `sk-ant-e2e` (Anthropic) or `sk-e2e` (OpenAI) is valid.
// POST /__control {"mode": "ok" | "401" | "429" | "400"} switches Claude's answers so tests can
// exercise error paths; GET /__calls lists what was called (for assertions).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.MOCK_API_PORT || 4999);
const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', `${name}.json`), 'utf8'));

let mode = 'ok';
const calls: string[] = [];

type Schema = { properties?: Record<string, unknown> };

/** Picks the canned answer for a structured Claude call by looking at the JSON schema it asked for. */
function answerFor(schema: Schema | undefined, prompt: string): unknown {
  const p = schema?.properties || {};
  if ('translations' in p) { // lib/translate.ts: one English text per input string
    const list = JSON.parse(prompt.slice(prompt.indexOf('STRINGS:') + 8)) as string[];
    return { translations: list.map((_, i) => `Translated text ${i + 1}`) };
  }
  if ('taches' in p) return 'cecr' in p ? fixture('correction-eo') : fixture('correction-ee');
  if ('t2' in p && 't3' in p) return fixture('topics');
  if ('titre' in p && 'doc1' in p) return fixture('consigne-t3');
  if ('texte' in p) return fixture('consigne-t1t2');
  return {};
}

const send = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};
const anthropicError = (res: http.ServerResponse, status: number, type: string, message: string) =>
  send(res, status, { type: 'error', error: { type, message } });

const server = http.createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  const body = raw ? JSON.parse(raw) : {};
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  calls.push(`${req.method} ${url.pathname}`);

  // --- test control ---
  if (url.pathname === '/__control') { mode = body.mode || 'ok'; return send(res, 200, { mode }); }
  if (url.pathname === '/__calls') return send(res, 200, calls);

  // --- Anthropic ---
  const antKey = String(req.headers['x-api-key'] || '');
  if (url.pathname === '/v1/models') {
    if (!antKey.startsWith('sk-ant-e2e')) return anthropicError(res, 401, 'authentication_error', 'invalid x-api-key');
    return send(res, 200, { data: [{ id: 'claude-sonnet-5-5', type: 'model' }], has_more: false });
  }
  if (url.pathname === '/v1/messages') {
    if (mode === '401' || !antKey.startsWith('sk-ant-e2e')) return anthropicError(res, 401, 'authentication_error', 'invalid x-api-key');
    if (mode === '429') return anthropicError(res, 429, 'rate_limit_error', 'rate limited');
    if (mode === '400') return anthropicError(res, 400, 'invalid_request_error', 'bad request');
    const schema = body.output_config?.format?.schema as Schema | undefined;
    return send(res, 200, {
      id: `msg_e2e_${calls.length}`, type: 'message', role: 'assistant', model: body.model,
      content: [{ type: 'text', text: JSON.stringify(answerFor(schema, String(body.messages?.[0]?.content ?? ''))) }],
      stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1000, output_tokens: 500 },
    });
  }

  // --- OpenAI ---
  const oaKey = String(req.headers.authorization || '').replace(/^Bearer /, '');
  if (url.pathname.startsWith('/openai/v1/')) {
    if (!oaKey.startsWith('sk-e2e')) return send(res, 401, { error: { message: 'Incorrect API key provided.', type: 'invalid_request_error' } });
    if (url.pathname === '/openai/v1/models') return send(res, 200, { object: 'list', data: [{ id: 'gpt-realtime-2.1' }] });
    if (url.pathname === '/openai/v1/realtime/client_secrets') return send(res, 200, { value: 'ek_e2e_test', expires_at: 0 });
  }

  send(res, 404, { error: { message: `mock: no route for ${req.method} ${url.pathname}` } });
});

server.listen(PORT, () => console.log(`mock API on http://localhost:${PORT}`));
