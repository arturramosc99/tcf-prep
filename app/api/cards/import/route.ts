import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { importCards } from '@/lib/cards';

/** Imports a card pack (.json sent from the Settings page). */
export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const data = await req.json().catch(() => null);
  const r = await importCards(data);
  return 'error' in r ? NextResponse.json(r, { status: 400 }) : NextResponse.json(r);
}
