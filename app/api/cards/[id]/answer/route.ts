import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { answerCard } from '@/lib/cards';

/** Result of an answer: moves the box up or back and schedules the next review. */
export async function POST(req: Request, ctx: RouteContext<'/api/cards/[id]/answer'>) {
  const denied = await guard();
  if (denied) return denied;
  const { ok } = await req.json().catch(() => ({}));
  if (typeof ok !== 'boolean') return NextResponse.json({ error: 'Envie { ok: true|false }.' }, { status: 400 });
  const r = await answerCard(Number((await ctx.params).id), ok);
  return r ? NextResponse.json(r) : NextResponse.json({ error: 'Card not found.' }, { status: 404 });
}
