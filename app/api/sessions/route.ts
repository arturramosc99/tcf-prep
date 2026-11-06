import { guard } from '@/lib/auth';
import { after, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { runCorrection } from '@/lib/correct';
import { legacyId, markUsed } from '@/lib/consignes';
import { snapshotFor } from '@/lib/ee';

export const maxDuration = 300;

// Creates the session (written or oral) and starts the correction in the background.
// `key` avoids duplicate sessions when the same submission is repeated (page reload).
export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const { kind, key, minutes, payload } = await req.json();
  if (kind !== 'ee' && kind !== 'eo') return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
  const [prev] = await sql<{ id: number }>(`SELECT id FROM sessions WHERE payload->>'key' = $1`, [key]);
  if (prev) return NextResponse.json({ id: prev.id });
  if (kind === 'ee') {
    // keep the prompt texts with the session, so it can be corrected again later whatever happens to the prompt
    const ids = payload?.ids || {};
    payload.ids = Object.fromEntries([1, 2, 3].map((n) => [`t${n}`, legacyId(n, ids[`t${n}`] ?? '')]));
    const consignes = await snapshotFor(payload.ids);
    if (!consignes) return NextResponse.json({ error: 'Unknown prompt. Draw the prompts again.' }, { status: 400 });
    payload.consignes = consignes;
  }
  const [s] = await sql<{ id: number }>(
    `INSERT INTO sessions (kind, status, minutes, payload, correcting_since) VALUES ($1, 'correcting', $2, $3, now()) RETURNING id`,
    [kind, minutes, JSON.stringify({ ...payload, key })]);
  // the prompt counts as practised on submission, even if the correction fails
  if (kind === 'ee') await markUsed(payload.ids, s.id);
  after(() => runCorrection(s.id));
  return NextResponse.json({ id: s.id });
}
