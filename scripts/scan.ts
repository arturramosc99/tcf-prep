// Pre-publish scan: secrets and personal data in the files git would commit.
// Personal terms (your name, email, city…) go in a .personal-terms file, one per line. That file is gitignored,
// so the list itself never ends up in the repository.
// Usage: npm run scan   (exit code 1 when something is found)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const SECRETS: [RegExp, string][] = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/, 'Anthropic key'],
  [/\bsk-(?!ant-)(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/, 'OpenAI key'],
  [/postgres(?:ql)?:\/\/[^\s:'"@/]+:[^\s'"@]+@/, 'database URL with password'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/\b(?:SESSION_SECRET|APP_PASSWORD)=\S{6,}/, 'secret value in an env assignment'],
];

export function findProblems(text: string, terms: string[]) {
  const out: { line: number; what: string }[] = [];
  text.split('\n').forEach((l, i) => {
    for (const [re, what] of SECRETS) if (re.test(l)) out.push({ line: i + 1, what });
    const low = l.toLowerCase();
    for (const t of terms) if (low.includes(t)) out.push({ line: i + 1, what: `personal term "${t}"` });
  });
  return out;
}

if (process.argv[1]?.endsWith('scan.ts')) {
  const terms = fs.existsSync('.personal-terms')
    ? fs.readFileSync('.personal-terms', 'utf8').split('\n').map((t) => t.trim().toLowerCase()).filter((t) => t && !t.startsWith('#'))
    : [];
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
    .split('\n').filter((f) => f && fs.existsSync(f) && !/\.(png|jpe?g|ico|gif|webp|woff2?)$/.test(f) && f !== 'package-lock.json');
  let n = 0;
  for (const f of files) {
    for (const p of findProblems(fs.readFileSync(f, 'utf8'), terms)) { console.log(`${f}:${p.line}  ${p.what}`); n++; }
  }
  console.log(n ? `\n${n} problem(s) found.` : `Scanned ${files.length} files${terms.length ? ` (${terms.length} personal terms)` : ' (no .personal-terms file)'}: nothing found.`);
  process.exit(n ? 1 : 0);
}
