# Local development

```bash
git clone https://github.com/<you>/tcf-prep.git && cd tcf-prep
npm ci
npm run dev          # http://localhost:3000
```
- Without `DATABASE_URL` the app uses PGlite, a Postgres that lives in `.data/pglite`. Delete that folder to start over.
- Copy `.env.example` to `.env.local` for any variable you need. `.env.local` is never committed.
- On first visit you go through the same setup guide as in production. Paste real keys only if you want real
  corrections; otherwise use the tests below, which fake both APIs.

## Tests (no network, no keys)
```bash
npm run test:unit         # node:test
npm run test:e2e:install  # once: Chromium for Playwright
npm run test:e2e          # builds the app into .next-e2e and runs it against e2e/mock-api.ts
```
- `e2e/mock-api.ts` imitates Anthropic and OpenAI. `e2e/fixtures/` holds its canned answers.
- The e2e run uses a throwaway database in `.data/e2e` and sets every variable explicitly, so your `.env.local`
  never leaks into tests.
- Screenshots of every page in 3 sizes × light/dark land in `test-results/screens/` (see `docs/qa/`).

## Advanced
- `CLAUDE_CLI_FALLBACK=1`: corrections go through a logged-in `claude` CLI when no key is saved (uses your subscription).
- `LEGACY_DIR`: one-time import of a history exported from another tool (`seed.json`, see `lib/legacy.ts`).
- `scripts/consignes-to-pack.ts`: turns a numbered prompt file into a prompt pack ([formats.md](formats.md)).
- `npm run scan`: secrets and personal terms (from your gitignored `.personal-terms`) in files git would commit.
