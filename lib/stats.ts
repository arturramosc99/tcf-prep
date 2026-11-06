import { sql } from './db';

export type Scored = { id: number; kind: 'ee' | 'eo'; label: string | null; created_at: string; score: number; nclc: string; minutes: number | null };

export async function scoredSessions(): Promise<Scored[]> {
  return sql<Scored>(`SELECT id, kind, label, created_at, score, nclc, minutes FROM sessions
    WHERE status = 'done' AND score IS NOT NULL ORDER BY created_at ASC`);
}

export function summary(list: Scored[]) {
  const last = list.at(-1);
  const last3 = list.slice(-3);
  const avg3 = last3.length ? last3.reduce((a, s) => a + s.score, 0) / last3.length : null;
  const best = list.length ? Math.max(...list.map((s) => s.score)) : null;
  return { last, avg3, best, count: list.length };
}

export const fmtScore = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(1).padStart(4, '0'));
export const fmtDate = (d: string, timeZone?: string) => new Date(d).toLocaleDateString('en-CA', { day: '2-digit', month: 'short', timeZone });
