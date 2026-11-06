import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { pendingTranslation, translateBatch } from '@/lib/translate';

export const maxDuration = 300;

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  return NextResponse.json(await pendingTranslation());
}

/** Translates one batch of older Portuguese text; the page calls it again until `left` is 0. */
export async function POST() {
  const denied = await guard();
  if (denied) return denied;
  try {
    return NextResponse.json(await translateBatch());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
