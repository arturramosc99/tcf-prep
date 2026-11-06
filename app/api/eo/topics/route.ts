import { guard } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { generateTopics } from '@/lib/eo';

export const maxDuration = 120;

export async function POST() {
  const denied = await guard();
  if (denied) return denied;
  try {
    return NextResponse.json(await generateTopics());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
