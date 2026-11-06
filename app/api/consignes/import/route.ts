import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { importConsignes } from '@/lib/consignes';

/** Imports a prompt pack (.json sent from the Settings page; format in docs/formats.md). */
export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const r = await importConsignes(await req.json().catch(() => null));
  return 'error' in r ? NextResponse.json(r, { status: 400 }) : NextResponse.json(r);
}
