// Settings stored in the database: password (scrypt hash), session secret and API keys (AES-256-GCM).
// Environment variables, when set, take priority over what was saved in the app.
import crypto from 'node:crypto';
import { sql } from './db';

export async function get(key: string): Promise<string | null> {
  const [r] = await sql<{ value: string }>('SELECT value FROM settings WHERE key = $1', [key]);
  return r?.value ?? null;
}
export async function set(key: string, value: string | null) {
  if (value === null) await sql('DELETE FROM settings WHERE key = $1', [key]);
  else await sql('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, value]);
}

const G = globalThis as unknown as { __tcfSecretMigrated?: Promise<void> };

/** Signing/encryption secret. In production it should come from SESSION_SECRET (outside the database),
 * so a database leak alone does not reveal the API keys. */
export async function secret(): Promise<string> {
  if (process.env.SESSION_SECRET) {
    G.__tcfSecretMigrated ??= migrateToEnvSecret(process.env.SESSION_SECRET);
    await G.__tcfSecretMigrated;
    return process.env.SESSION_SECRET;
  }
  let s = await get('session_secret');
  if (!s) {
    await sql('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT DO NOTHING', ['session_secret', crypto.randomBytes(32).toString('hex')]);
    s = (await get('session_secret'))!;
  }
  return s;
}

export const secretInEnv = () => Boolean(process.env.SESSION_SECRET);

const keyFrom = (sec: string) => crypto.createHash('sha256').update(sec).digest();
const aesKey = async () => keyFrom(await secret());

// When SESSION_SECRET appears, re-encrypt the keys saved with the old (database) secret, then delete it.
async function migrateToEnvSecret(envSecret: string) {
  const old = await get('session_secret');
  if (!old) return;
  for (const p of ['anthropic', 'openai']) {
    const box = await get(`key_${p}`);
    if (!box) continue;
    try { decryptWith(keyFrom(envSecret), box); continue; } catch {} // another instance already migrated this key
    try { await set(`key_${p}`, encryptWith(keyFrom(envSecret), decryptWith(keyFrom(old), box))); } catch {}
  }
  await set('session_secret', null);
}

function encryptWith(key: Buffer, plain: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}
function decryptWith(key: Buffer, box: string) {
  const [iv, tag, data] = box.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}

const encrypt = async (plain: string) => encryptWith(await aesKey(), plain);
const decrypt = async (box: string) => decryptWith(await aesKey(), box);

// ---------- password ----------
export async function passwordConfigured() {
  return Boolean(process.env.APP_PASSWORD) || Boolean(await get('password_hash'));
}

export async function checkPassword(pw: string) {
  if (process.env.APP_PASSWORD) return crypto.timingSafeEqual(
    crypto.createHash('sha256').update(pw).digest(), crypto.createHash('sha256').update(process.env.APP_PASSWORD).digest());
  const stored = await get('password_hash');
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(test), Buffer.from(hash));
}

export async function setPassword(pw: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  await set('password_hash', `${salt}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`);
}

// ---------- API keys ----------
export type Provider = 'anthropic' | 'openai';
const ENV: Record<Provider, string> = { anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY' };

export async function apiKey(p: Provider): Promise<string | null> {
  if (process.env[ENV[p]]) return process.env[ENV[p]]!;
  await secret(); // make sure the secret migration ran before reading the encrypted key
  const box = await get(`key_${p}`);
  if (!box) return null;
  try { return await decrypt(box); } catch { return null; }
}

export async function keyStatus(p: Provider) {
  if (process.env[ENV[p]]) return { source: 'env' as const, hint: mask(process.env[ENV[p]]!) };
  const k = await apiKey(p);
  return k ? { source: 'app' as const, hint: mask(k) } : { source: null, hint: null };
}

const mask = (k: string) => `${k.slice(0, 7)}…${k.slice(-4)}`;

export async function saveKey(p: Provider, key: string | null) {
  await set(`key_${p}`, key ? await encrypt(key.trim()) : null);
}

// API base URLs: overridable so tests can point them at a local mock (e2e/mock-api.ts).
export const anthropicBase = () => process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
export const openaiBase = () => process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

/** Makes a cheap call to check that the key works. */
export async function testKey(p: Provider, key: string): Promise<string | null> {
  try {
    const r = p === 'anthropic'
      ? await fetch(`${anthropicBase()}/v1/models?limit=1`, { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } })
      : await fetch(`${openaiBase()}/models`, { headers: { Authorization: `Bearer ${key}` } });
    if (r.ok) return null;
    const j = await r.json().catch(() => ({}));
    return j.error?.message || `HTTP ${r.status}`;
  } catch (e) {
    return (e as Error).message;
  }
}
