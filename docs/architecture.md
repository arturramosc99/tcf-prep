# Architecture

## Stack
- **Next.js 16** (App Router, TypeScript). `cookies()` and `params` are async; read `node_modules/next/dist/docs/`
  before using a Next API.
- **Postgres** with raw SQL, no ORM: Neon in production (`@neondatabase/serverless`), **PGlite** in a local folder
  when there is no `DATABASE_URL`. The schema (`lib/db.ts`) runs on every boot and only ever adds.
- **Claude** (`@anthropic-ai/sdk`, default `claude-sonnet-5-5`) for corrections, Oral topics and new Écrite prompts,
  with structured output (`output_config.format` + JSON schema, effort `medium`).
- **OpenAI Realtime** (`gpt-realtime-2.1`, voice `marin`) over WebRTC in the browser, with an ephemeral key issued by
  the server; transcription with `gpt-4o-transcribe` (French).
- Styles: one hand-written stylesheet, `app/globals.css` (tokens at the top). Fonts: Geist and Geist Mono.
- Motion: React's `<ViewTransition>` (no animation library). `components/PageTransition.tsx` is used by the
  `template.tsx` of the root and of each route group: pages fade and rise into place, setup steps slide forward
  (`transitionTypes={FORWARD}`). `(app)/loading.tsx` shows breathing placeholders while a page loads; long AI waits use
  `<Dial working>`; buttons waiting on the server get `aria-busy` (spinner). "Reduce motion" turns all of it off.
- Deploy: push to `main` → Vercel builds and publishes.

## Files
```
app/
  layout.tsx                 html/body, fonts, viewport
  template.tsx               page transition between route groups (each group has its own template.tsx too)
  globals.css                the whole design system, motion included
  (auth)/welcome/            first visit: what it is, costs, create password
  (auth)/login/              log in
  (setup)/setup/*            setup guide: claude, openai, start (tour + target)
  (app)/layout.tsx           header + nav; database check
  (app)/page.tsx             dashboard
  (app)/written/             Expression écrite simulation (Written.tsx is the client part)
  (app)/oral/                Expression orale simulation with WebRTC (Oral.tsx)
  (app)/flashcards/          summary + practice round
  (app)/history/  errors/    scores over time; recurring error patterns
  (app)/settings/            keys, preferences, setup guide, pack imports
  (app)/session/[id]/        one session's correction (components/SessionView)
  api/…                      route handlers, each starting with guard()
components/  Dial, Ring, Spark, ScoreChart, StatusToggle, SessionView, Nav, Tip, LogoutButton, PageTransition, Skeleton
lib/
  db.ts        connection, schema, boot-time upgrades, dbProblem()
  auth.ts      HMAC cookie, requirePage() (also sends unfinished installs to the setup guide), guard()
  settings.ts  password (scrypt), secret, API keys (AES-256-GCM), key test, API base URLs
  onboarding.ts setup steps, page tips, timezone, NCLC target
  claude.ts    structured call + plain-JSON fallback (+ opt-in CLI fallback)
  consignes.ts Écrite prompts: bank, packs, AI-written, pasted; draw, usage, import
  ee.ts / eo.ts Written / Oral: schema and correction prompt (Oral: topics and examiner instructions too)
  correct.ts   runCorrection(); a stuck correction becomes an error after 7 min
  errors.ts    patterns, occurrences, markdown export
  status.ts    pattern status rule (client-safe)
  cardrules.ts / cards.ts  flashcards: rules (client-safe) / storage, rounds, import
  scale.ts     score /20 → NCLC → CEFR, target bands
data/          correction-method.md, task-structure.md (in the correction prompt), consignes/bank.json
e2e/ tests/    Playwright (with e2e/mock-api.ts) and node:test unit tests
```

## Tables
- `sessions`: kind `ee|eo`, status `correcting|done|error`, payload (prompt ids and texts, or topics + transcript),
  correction JSON, score, nclc.
- `consignes` (imported, AI-written and pasted prompts) and `consigne_uses` (what was practised, recorded on submit).
- `error_patterns` (unique slug) and `error_occurrences`.
- `cards`: flashcards with a box 0–5 and a due date.
- `settings`: password hash, encrypted keys, setup step, tips, timezone, target.
- `login_attempts`: brute-force lockout per IP.

## Main flows
- **Correction:** `POST /api/sessions` saves the session as `correcting` (with the prompt texts) and starts
  `runCorrection` after the response. Claude returns JSON where each error has a `pattern_slug`; errors are linked
  to patterns (new ones are created) and turned into flashcards. The page polls `/api/sessions/[id]`.
- **Pattern status:** over finished sessions, newest first: critical = 2+ in the last 3; active = in the last one;
  under control = 3+ in total and none in the last 3; resolved = none in the last 6; otherwise watching.
- **Oral:** one WebRTC connection per tâche. T1 120 s; T2 120 s preparation + 210 s; T3 270 s. Turn-taking is set
  per tâche in `api/eo/token`; in T1 the client decides when the examiner replies (after a real silence) and may
  interrupt a long answer, as some real examiners do.
- **Prompts:** a draw takes an unused prompt per tâche from the bank, imported packs and earlier AI prompts; when
  none is left, Claude writes one. Pasted prompts are used once and never drawn.
- **Scale:** 4–5 NCLC 4, 6 NCLC 5, 7–9 NCLC 6, 10–11 NCLC 7, 12–13 NCLC 8, 14–15 NCLC 9, 16+ NCLC 10 (floor, so 9.5 is NCLC 6).

## Environment variables
See `.env.example`.
