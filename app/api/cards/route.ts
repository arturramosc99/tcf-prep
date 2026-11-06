import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { roundCards } from '@/lib/cards';

/** A practice round: ?pattern=slug practises one pattern only. */
export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const slug = new URL(req.url).searchParams.get('pattern');
  return NextResponse.json({ cards: await roundCards(slug) });
}
