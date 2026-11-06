// Official TCF Canada conversion (written and oral, score out of 20) → NCLC (CLB) → CEFR.
export function nclcFor(score: number): number {
  const s = Math.floor(score);
  if (s >= 16) return 10;
  if (s >= 14) return 9;
  if (s >= 12) return 8;
  if (s >= 10) return 7;
  if (s >= 7) return 6;
  if (s >= 6) return 5;
  if (s >= 4) return 4;
  return 3;
}

export function cecrFor(score: number): string {
  if (score >= 16) return 'C2';
  if (score >= 14) return 'C1';
  if (score >= 10) return 'B2';
  if (score >= 6) return 'B1';
  if (score >= 4) return 'A2';
  return 'A1';
}

export const SCALE_TEXT =
  'Score from 0 to 20. Official TCF Canada → NCLC conversion: 4–5 = NCLC 4; 6 = NCLC 5; 7–9 = NCLC 6; 10–11 = NCLC 7; 12–13 = NCLC 8; 14–15 = NCLC 9; 16–20 = NCLC 10+. TCF CEFR equivalence: 0–3 A1, 4–5 A2, 6–9 B1, 10–13 B2, 14–15 C1, 16–20 C2.';

// Lowest score out of 20 for each NCLC level (the conversion above).
const MIN_SCORE: Record<number, number> = { 4: 4, 5: 6, 6: 7, 7: 10, 8: 12, 9: 14, 10: 16 };
export type Target = { nclc: number; min: number; max: number };
export const targetFor = (nclc: number): Target => ({ nclc, min: MIN_SCORE[nclc], max: nclc >= 10 ? 20 : MIN_SCORE[nclc + 1] - 1 });

export const targetLine = (t: Target) => `Candidate's target: NCLC ${t.nclc} (${t.min}–${t.max}/20).`;

/** Traffic light for a score: green = target reached, yellow = within 3 points, red = further away. */
export const scoreTone = (score: number, t: Target) => (score >= t.min ? 'good' : score >= t.min - 3 ? 'warn' : 'bad');
