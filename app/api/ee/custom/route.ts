import { guard } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { addOwn, consigneLabel } from '@/lib/consignes';

/** Saves a prompt the user pasted (e.g. found on a prep website) to practise with it once. */
export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const { tache, content } = (await req.json().catch(() => ({}))) as { tache?: number; content?: unknown };
  if (tache !== 1 && tache !== 2 && tache !== 3) return NextResponse.json({ error: 'tache must be 1, 2 or 3.' }, { status: 400 });
  const r = await addOwn(tache, content);
  if ('error' in r) return NextResponse.json({ error: `Your prompt can't be used: ${r.error}.` }, { status: 400 });
  return NextResponse.json({ id: r.id, label: consigneLabel(r.id), content: r.content });
}
