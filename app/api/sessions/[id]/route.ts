import { guard } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/correct';

export async function GET(_req: Request, ctx: RouteContext<'/api/sessions/[id]'>) {
  const denied = await guard();
  if (denied) return denied;
  const s = await getSession(Number((await ctx.params).id));
  return s ? NextResponse.json(s) : NextResponse.json({ error: 'Session not found.' }, { status: 404 });
}
