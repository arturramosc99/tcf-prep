# QA

Three layers, from cheapest to most manual. Run all three before a release; run the first after every change.

| Layer | What | How long |
| --- | --- | --- |
| Automated | `npm run lint && npm run typecheck && npm run test:unit && npm run test:e2e && npm run scan` | ~3 min |
| Visual | Look at the screenshots the e2e run saves (below) against [matrix.md](matrix.md) | ~10 min |
| Manual | [checklist.md](checklist.md): things a robot can't check (real voice, a real phone, a real install) | ~45 min |
| Security | [security.md](security.md) when auth, keys, the database or an API route changed | ~20 min |

## What the automated tests cover
All offline: `e2e/mock-api.ts` replaces Anthropic and OpenAI; the database is a throwaway PGlite folder.

| File | Covers |
| --- | --- |
| `e2e/setup.ts` | fresh install: welcome, password rules, setup guide (bad/good key, skip), guide blocks the app until done |
| `e2e/auth.spec.ts` | every page redirects and every API answers 401 when logged out; wrong/right password |
| `e2e/layout.spec.ts` | every page × 375/768/1280 × light/dark: no horizontal scroll, no console errors, nav fits, screenshots |
| `e2e/written.spec.ts` | full Written simulation: timer, accents, word counter, draft survives reload, correction, errors, history |
| `e2e/oral.spec.ts` | topics, refused microphone, voice connection failure, an Oral session's transcript and rephrasings |
| `e2e/prompts.spec.ts` | Claude-written prompts when the bank runs out, pasted prompts, prompt packs |
| `e2e/flashcards.spec.ts` | multiple choice, retry, typing mode, archive, card pack import |
| `e2e/progress.spec.ts` | Errors (statuses, markdown export), History, rejected key + retry, unknown/malformed sessions |
| `e2e/onboarding.spec.ts` | page tips, reopening the guide, NCLC target |
| `e2e/keys.spec.ts` | keys are tested before saving |
| `tests/unit/*` | flashcard rules, prompts, onboarding state, database upgrades, API URLs, CLI fallback, scanner |

## Screenshots
After `npm run test:e2e`, every page of the layout matrix is in `test-results/screens/<size>-<theme>/<page>.png`
(e.g. `layout-mobile-dark/written.png`), and the welcome page in `test-results/screens/welcome-*.png`.
README images: `npm run screenshots` → `docs/screenshots/`.

## When a test fails
- `npx playwright show-report` opens the HTML report with a trace of each failure (every click, the DOM, the network).
- A new page or API route? Add it to `PAGES`/`APIS` in `e2e/auth.spec.ts` and to `PAGES` in `e2e/layout.spec.ts`.
