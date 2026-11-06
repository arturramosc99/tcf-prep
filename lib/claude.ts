// Structured call to Claude: the API (key saved in Settings or ANTHROPIC_API_KEY). A logged-in `claude` CLI
// is a local alternative only with CLAUDE_CLI_FALLBACK=1 (never by accident: it would spend the runner's subscription).
import { spawn } from 'node:child_process';
import os from 'node:os';
import Anthropic from '@anthropic-ai/sdk';
import { apiKey } from './settings';

const MODEL = process.env.TCF_MODEL || 'claude-sonnet-5-5';

export async function structured<T>(prompt: string, schema: object, system: string): Promise<T> {
  const key = await apiKey('anthropic');
  if (key) return viaApi<T>(key, prompt, schema, system);
  if (process.env.CLAUDE_CLI_FALLBACK === '1' && !process.env.VERCEL) return viaCli<T>(prompt, schema, system);
  throw new Error('Claude key not configured. Paste your key in Settings.');
}

// Structured output via output_config.format (Sonnet 5.5 rejects a forced tool_choice).
// The format requires additionalProperties: false on every object in the schema.
function strictSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictSchema);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) out[k] = k === 'properties'
    ? Object.fromEntries(Object.entries(v as object).map(([pk, pv]) => [pk, strictSchema(pv)]))
    : strictSchema(v);
  if (out.type === 'object') out.additionalProperties = false;
  return out;
}

async function viaApi<T>(key: string, prompt: string, schema: object, system: string): Promise<T> {
  const client = new Anthropic({ apiKey: key, maxRetries: 2 });
  const base = { model: MODEL, max_tokens: 20000, system } as const;
  let res: Anthropic.Message;
  let strict = true;
  try {
    try {
      res = await client.messages.create({
        ...base,
        // effort medium: a full correction in ~1–2 min, inside Vercel's 5-minute function limit
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: strictSchema(schema) as Record<string, unknown> } },
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (e) {
      // If the schema is rejected by structured output, ask for the JSON in plain text (like the CLI path).
      if (!(e instanceof Anthropic.BadRequestError)) throw e;
      strict = false;
      res = await client.messages.create({
        ...base,
        output_config: { effort: 'medium' },
        messages: [{ role: 'user', content: `${prompt}\n\nAnswer only with a valid JSON object that follows exactly this JSON Schema, with no text before or after:\n${JSON.stringify(schema)}` }],
      });
    }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('Your Claude key was rejected. Replace it in Settings.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Claude API rate limit reached (or no credits left). Try again in a few minutes and check your balance at console.anthropic.com.');
    if (e instanceof Anthropic.APIError) throw new Error(`API Claude (${e.status}): ${e.message}`);
    throw e;
  }
  if (res.stop_reason === 'refusal') throw new Error('Claude declined this correction. Try again.');
  if (res.stop_reason === 'max_tokens') throw new Error('The correction was too long and got cut off. Try again.');
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try {
    return JSON.parse(strict ? text : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as T;
  } catch {
    throw new Error('Claude\'s answer did not contain the requested JSON.');
  }
}

function cleanEnv() {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || /^(CLAUDE|ANTHROPIC_BASE_URL|CLAUDECODE|AI_AGENT)/.test(k)) continue;
    env[k] = v;
  }
  return env;
}

function viaCli<T>(prompt: string, schema: object, system: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--output-format', 'json', '--json-schema', JSON.stringify(schema),
      '--tools', '', '--no-session-persistence', '--setting-sources', '',
      '--model', process.env.TCF_CLI_MODEL || 'sonnet', '--effort', 'low', '--system-prompt', system];
    const p = spawn('claude', args, { cwd: os.tmpdir(), env: cleanEnv() as NodeJS.ProcessEnv });
    let out = '', err = '';
    const timer = setTimeout(() => { p.kill('SIGTERM'); reject(new Error('The correction took more than 12 minutes.')); }, 12 * 60000);
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => { clearTimeout(timer); reject(new Error(`Could not run the claude CLI: ${e.message}`)); });
    p.on('close', () => {
      clearTimeout(timer);
      try {
        const res = JSON.parse(out);
        if (res.is_error) return reject(new Error(`claude CLI: ${res.result || res.subtype}`));
        if (res.structured_output) return resolve(res.structured_output as T);
        resolve(JSON.parse(String(res.result).match(/\{[\s\S]*\}/)![0]) as T);
      } catch {
        reject(new Error(`No valid answer from the claude CLI. ${err.slice(0, 300)}`));
      }
    });
    // a CLI that quits early (not logged in, bad flag) closes stdin: the write fails with EPIPE. That is not the
    // error to report — 'close' above reports what the CLI said.
    p.stdin.on('error', () => {});
    p.stdin.end(prompt);
  });
}
