import { NextResponse } from 'next/server';
import { COOKIE, cookieOptions, makeToken } from '@/lib/auth';
import { dbProblem, sql } from '@/lib/db';
import { setTimezone } from '@/lib/onboarding';
import { checkPassword, passwordConfigured, setPassword } from '@/lib/settings';

// Limit on wrong attempts: per IP and in total, in a 15-minute window.
const WINDOW = "interval '15 minutes'";
const PER_IP = 8;
const GLOBAL = 40;

// First visit (no saved password): creates the password. Afterwards: checks it.
export async function POST(req: Request) {
  const problem = await dbProblem();
  if (problem) return NextResponse.json({ error: `Database not connected: ${problem}` }, { status: 503 });
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';

  await sql(`DELETE FROM login_attempts WHERE at < now() - ${WINDOW}`);
  const [{ mine, all }] = await sql<{ mine: number; all: number }>(
    `SELECT count(*) FILTER (WHERE ip = $1)::int AS mine, count(*)::int AS all FROM login_attempts`, [ip]);
  if (mine >= PER_IP || all >= GLOBAL) {
    return NextResponse.json({ error: 'Too many wrong attempts. Wait 15 minutes and try again.' }, { status: 429 });
  }

  const { password, timezone } = await req.json().catch(() => ({}));
  if (typeof password !== 'string' || !password) return NextResponse.json({ error: 'Enter the password.' }, { status: 400 });
  if (!(await passwordConfigured())) {
    if (password.length < 10) return NextResponse.json({ error: 'Use at least 10 characters.' }, { status: 400 });
    await setPassword(password);
    if (typeof timezone === 'string') await setTimezone(timezone).catch(() => {}); // dates in the user's own timezone
  } else if (!(await checkPassword(password))) {
    await sql('INSERT INTO login_attempts (ip) VALUES ($1)', [ip]);
    return NextResponse.json({ error: 'Wrong password.' }, { status: 401 });
  }
  await sql('DELETE FROM login_attempts WHERE ip = $1', [ip]);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await makeToken(), cookieOptions);
  return res;
}
