import { guard } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { consigneLabel, legacyId, pickOne, type Consigne } from '@/lib/consignes';
import { snapshotFor } from '@/lib/ee';

// Drawing may ask Claude for a new prompt when every prompt of a tâche has been used.
export const maxDuration = 120;

const labels = (ids: Record<string, string>) => Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, consigneLabel(v)]));

// GET ?ids=a,b,c reuses a draw saved in the browser (old drafts may hold plain numbers).
export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const q = new URL(req.url).searchParams.get('ids');
  if (!q) return NextResponse.json({ error: 'Missing ids.' }, { status: 400 });
  const ids = Object.fromEntries(q.split(',').map((v, i) => [`t${i + 1}`, legacyId(i + 1, v)]));
  const c = await snapshotFor(ids);
  if (!c) return NextResponse.json({ error: 'A saved prompt is no longer available. Draw new prompts.' }, { status: 404 });
  return NextResponse.json({ ids, labels: labels(ids), ...c });
}

// POST draws three prompts not practised yet.
export async function POST() {
  const denied = await guard();
  if (denied) return denied;
  try {
    const picked: Consigne[] = [];
    for (const t of [1, 2, 3] as const) picked.push(await pickOne(t));
    const ids = Object.fromEntries(picked.map((c) => [`t${c.tache}`, c.id]));
    return NextResponse.json({ ids, labels: labels(ids), ...Object.fromEntries(picked.map((c) => [`t${c.tache}`, c.content])) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
