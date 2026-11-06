import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { archiveCard } from '@/lib/cards';

/** Archive (or unarchive) a card that is not useful. */
export async function PATCH(req: Request, ctx: RouteContext<'/api/cards/[id]'>) {
  const denied = await guard();
  if (denied) return denied;
  const { archived } = await req.json().catch(() => ({}));
  if (typeof archived !== 'boolean') return NextResponse.json({ error: 'Envie { archived: true|false }.' }, { status: 400 });
  return (await archiveCard(Number((await ctx.params).id), archived))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'Card not found.' }, { status: 404 });
}
