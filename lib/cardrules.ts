// Flashcard rules with no database (safe on the client): card from an error, distractors,
// checking a typed answer and the spaced-repetition schedule.

export type CardKind = 'mot' | 'phrase';
export type CardDraft = { kind: CardKind; prompt: string; hint: string | null; answer: string; wrong: string[]; rule: string };
export type Card = CardDraft & { id: number; box: number; pattern_slug: string | null; pattern_titre: string | null };

export const BLANK = '___';
export const MAX_BOX = 5;
/** box 0–1: multiple choice; from here on, type from scratch */
export const TYPE_FROM_BOX = 2;
/** days until the next review, by the new box */
export const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16];
export const ACCENTS = ['é', 'è', 'ê', 'ë', 'à', 'â', 'î', 'ï', 'ô', 'û', 'ù', 'ü', 'ç', 'œ', 'É', 'À', 'Ç', '«', '»'];

/** normalises spaces, curly apostrophes and Unicode form */
export const norm = (s: string) => (s || '').normalize('NFC').replace(/[’ʼ`]/g, "'").replace(/\s+/g, ' ').trim();

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const stripEnd = (s: string) => s.replace(/[\s.!?…]+$/, '');

/** Right or wrong: ignores extra spaces, ’ vs ', a capital first letter and a final full stop. Accents always count. */
export function same(typed: string, answer: string) {
  return lowerFirst(stripEnd(norm(typed))) === lowerFirst(stripEnd(norm(answer)));
}

export const nextBox = (box: number, ok: boolean) => (ok ? Math.min(box + 1, MAX_BOX) : 0);
export const nextDue = (box: number, now = Date.now()) => new Date(now + INTERVAL_DAYS[box] * 86_400_000);

/** "Fix this sentence" cards. Older installs wrote the Portuguese prefix "Corrija:"; both are accepted. */
export const FIX = 'Fix:';
export const isFixPrompt = (p: string) => /^(Fix|Corrija):/.test(norm(p));
const canonFix = (p: string) => norm(p).replace(/^Corrija:/, FIX);

export const dedupKey = (c: Pick<CardDraft, 'kind' | 'prompt' | 'answer'>) =>
  `${c.kind}|${canonFix(c.prompt).toLowerCase()}|${norm(c.answer)}`;

const bare = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function lev(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

const GROUPS = ['eéèê', 'aàâ', 'uùû', 'oô', 'iî', 'cç'];
/** variants changing one accent at a time (sécurité → securité, sècurité…); adds an accent to a plain "e" only if short of options */
export function accentVariants(word: string): string[] {
  const chars = [...word];
  const vary = (only: (ch: string) => boolean) => {
    const out: string[] = [];
    chars.forEach((ch, i) => {
      const g = GROUPS.find((x) => x.includes(ch.toLowerCase()));
      if (!g || !only(ch)) return;
      for (const alt of g) {
        if (alt === ch.toLowerCase()) continue;
        out.push([...chars.slice(0, i), ch === ch.toUpperCase() ? alt.toUpperCase() : alt, ...chars.slice(i + 1)].join(''));
      }
    });
    return out;
  };
  const out = vary((ch) => /[^\x00-\x7f]/.test(ch));
  if (out.length < 3) out.push(...vary((ch) => ch.toLowerCase() === 'e'));
  return out.filter((v, i, a) => a.indexOf(v) === i);
}

const SWAPS: Record<string, string[]> = {
  le: ['la', "l'"], la: ['le', "l'"], un: ['une'], une: ['un'], les: ['des'], des: ['de', 'les'], de: ['des', 'du'],
  du: ['de la', 'des'], 'de la': ['du', 'de'], au: ['à la', 'à'], 'à la': ['au', 'à'], à: ['de', 'en', 'au'], en: ['à', 'dans'],
  dans: ['en', 'à'], qui: ['que', 'dont'], que: ['qui', 'dont'], dont: ['que', 'qui'], ce: ['cet', 'cette'], cet: ['ce', 'cette'],
  cette: ['ce', 'cet'], son: ['sa', 'ses'], sa: ['son', 'ses'], ses: ['leurs', 'son'], leur: ['leurs', 'son'], leurs: ['leur', 'ses'],
  si: ['se', "s'"], se: ['si', 'ce'], est: ['et', 'ait'], et: ['est'], a: ['à', 'as'], ou: ['où'], où: ['ou'],
};
/** grammatical distractors by swapping a word or an ending */
export function swapVariants(answer: string): string[] {
  const out: string[] = [];
  const lower = answer.toLowerCase();
  for (const s of SWAPS[lower] || []) out.push(s);
  const words = answer.split(' ');
  words.forEach((w, i) => {
    for (const s of SWAPS[w.toLowerCase()] || []) out.push([...words.slice(0, i), s, ...words.slice(i + 1)].join(' '));
  });
  const ends: [RegExp, string][] = [[/ent$/, 'ont'], [/ont$/, 'ent'], [/é$/, 'er'], [/er$/, 'é'], [/ant$/, 'ent'], [/ée$/, 'é'], [/e$/, '']];
  if (words.length === 1 && answer.length >= 4) for (const [re, rep] of ends) if (re.test(answer)) { out.push(answer.replace(re, rep)); break; }
  return out;
}

function pickWrong(answer: string, first: string | null, pool: string[], n = 3) {
  const out: string[] = [];
  for (const w of [first, ...pool]) {
    if (w === null || out.length >= n) continue;
    if (same(w, answer) && w !== '') continue;
    if (w === '' && answer === '') continue;
    if (out.some((o) => norm(o) === norm(w))) continue;
    out.push(w);
  }
  return out;
}

/** Card from a corrected error (faux → correct). No AI: a word-level diff. */
export function draftFromError(fauxIn: string, correctIn: string, rule: string): CardDraft | null {
  const faux = norm(fauxIn), correct = norm(correctIn);
  if (!correct || faux === correct) return null;
  // notes written by the corrector ("Pour finir (middle of the story)", "tout en + gerund") don't become cards;
  // the Portuguese words cover corrections made before the app was translated
  if ([faux, correct].some((t) => /[()+]|\b(after|before|each|without|verb|gerund|middle|um|uma|cada|depois|antes|verbo|sem|posição|gerúndio|meio)\b/i.test(t))) return null;
  const f = faux.split(' '), c = correct.split(' ');
  let pre = 0;
  while (pre < f.length && pre < c.length && f[pre] === c[pre]) pre++;
  let suf = 0;
  while (suf < f.length - pre && suf < c.length - pre && f[f.length - 1 - suf] === c[c.length - 1 - suf]) suf++;
  const fMid = f.slice(pre, f.length - suf).join(' ');
  const cMid = c.slice(pre, c.length - suf).join(' ');
  const context = pre + suf > 0;
  const prompt = [...c.slice(0, pre), BLANK, ...c.slice(c.length - suf)].join(' ');

  // spelling/accent of one word: a "mot" card, with the wrong word as the hint
  const oneWord = !fMid.includes(' ') && !cMid.includes(' ') && fMid && cMid;
  const spelling = bare(fMid) === bare(cMid) || (Math.min(fMid.length, cMid.length) >= 4 && lev(fMid.toLowerCase(), cMid.toLowerCase()) <= 2);
  if (oneWord && (spelling || !context)) {
    const pool = bare(fMid) === bare(cMid) ? accentVariants(cMid) : [...accentVariants(cMid), ...swapVariants(cMid)];
    return { kind: 'mot', prompt: context ? prompt : BLANK, hint: `you wrote “${fMid}”`, answer: cMid, wrong: pickWrong(cMid, fMid, pool), rule };
  }
  // short span with context: sentence with a gap
  if (context && cMid && c.slice(pre, c.length - suf).length <= 4 && f.slice(pre, f.length - suf).length <= 4) {
    return { kind: 'phrase', prompt, hint: null, answer: cMid, wrong: pickWrong(cMid, fMid, swapVariants(cMid)), rule };
  }
  // big difference (or an extra word): fix the whole sentence; without enough context, no card
  if (f.length < 3) return null;
  return { kind: 'phrase', prompt: `${FIX} «${faux}»`, hint: null, answer: correct, wrong: pickWrong(correct, faux, []), rule };
}

/** Letter-by-letter diff (LCS) between what was typed and the answer. */
export function charDiff(typed: string, answer: string): { t: string; k: 'ok' | 'extra' | 'missing' }[] {
  const a = [...norm(typed)], b = [...norm(answer)];
  const L = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
    L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: { t: string; k: 'ok' | 'extra' | 'missing' }[] = [];
  const push = (t: string, k: 'ok' | 'extra' | 'missing') => {
    const last = out[out.length - 1];
    if (last && last.k === k) last.t += t; else out.push({ t, k });
  };
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { push(a[i], 'ok'); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) push(a[i++], 'extra'); else push(b[j++], 'missing');
  }
  while (i < a.length) push(a[i++], 'extra');
  while (j < b.length) push(b[j++], 'missing');
  return out;
}

/** Validates a card from an imported pack; returns the reason when it is not usable. */
export function checkImported(x: unknown): string | null {
  const c = x as Record<string, unknown>;
  if (!c || typeof c !== 'object') return 'not an object';
  if (c.kind !== 'mot' && c.kind !== 'phrase') return 'kind must be "mot" or "phrase"';
  for (const k of ['prompt', 'answer', 'rule'] as const) if (typeof c[k] !== 'string' || !norm(c[k] as string)) return `${k} is empty`;
  if (c.kind === 'phrase' && (c.prompt as string).split(BLANK).length !== 2 && !isFixPrompt(c.prompt as string)) return 'a phrase needs exactly one ___';
  if (!Array.isArray(c.wrong) || !c.wrong.length || c.wrong.length > 3 || c.wrong.some((w) => typeof w !== 'string')) return 'wrong needs 1 to 3 strings';
  if ((c.wrong as string[]).some((w) => same(w, c.answer as string))) return 'a distractor equals the answer';
  if (c.hint != null && typeof c.hint !== 'string') return 'hint must be a string';
  if (c.pattern_slug != null && typeof c.pattern_slug !== 'string') return 'pattern_slug must be a string';
  return null;
}
