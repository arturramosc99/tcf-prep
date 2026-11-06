// Single-user login. Cookie = expiry + HMAC with the app secret.
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { dbProblem } from './db';
import { getOnboarding } from './onboarding';
import { passwordConfigured, secret } from './settings';

export const COOKIE = 'tcf_session';
const MAX_AGE = 60 * 60 * 24 * 90;

const sign = async (data: string) => crypto.createHmac('sha256', await secret()).update(data).digest('base64url');

export async function makeToken() {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  return `${exp}.${await sign(exp)}`;
}

async function validToken(token?: string) {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const good = await sign(exp);
  return good.length === sig.length && crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig));
}

export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: MAX_AGE };

export async function isAuthed() {
  return validToken((await cookies()).get(COOKIE)?.value);
}

/** Pages: no session → /login (→ /welcome on first visit); setup guide not finished → its current step.
 * The guide's own pages pass { setup: true } so they can be opened at any time. */
export async function requirePage(opts: { setup?: boolean } = {}) {
  if (!(await isAuthed())) redirect('/login');
  const o = await getOnboarding();
  if (!opts.setup && o.step !== 'done') redirect(`/setup/${o.step}`);
  return o;
}

/** API routes: returns the 401/503 response, or null when all is well. */
export async function guard() {
  const problem = await dbProblem();
  if (problem) return NextResponse.json({ error: `Database not connected: ${problem}` }, { status: 503 });
  if (await isAuthed()) return null;
  return NextResponse.json({ error: (await passwordConfigured()) ? 'Session expired. Log in again.' : 'Create the app password first.' }, { status: 401 });
}
