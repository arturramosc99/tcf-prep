import { guard } from '@/lib/auth';
import { after, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession, runCorrection } from '@/lib/correct';

export const maxDuration = 300;

export async function POST(_req: Request, ctx: RouteContext<'/api/sessions/[id]/retry'>) {
  const denied = await guard();
  if (denied) return denied;
  const id = Number((await ctx.params).id);
  if (!(await getSession(id))) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  await sql(`UPDATE sessions SET status = 'correcting', error = NULL, correcting_since = now() WHERE id = $1`, [id]);
  after(() => runCorrection(id));
  return NextResponse.json({ id });
}
