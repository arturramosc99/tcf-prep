<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# TCF Prep — instructions for AI coding agents

These instructions are for any coding assistant (Codex, Claude Code, Cursor, Gemini, Copilot…) working in this
repository, and for any assistant helping someone **install** the app. Humans: start with the README.

## What this is
A self-hosted web app to practise the TCF Canada *Expression écrite* and *Expression orale*. One user per install:
each person deploys their own copy on Vercel with a Neon Postgres database, and pays Anthropic (corrections) and
OpenAI (Oral voice) directly. The UI is in English; exam content (prompts, examiner speech, rewrites) is in French.

## Commands
```bash
npm ci                     # install
npm run dev                # http://localhost:3000 — local PGlite database in .data/pglite, no setup needed
npm run lint && npm run typecheck
npm run build
npm run test:unit          # node:test, offline
npm run test:e2e:install   # once: downloads Chromium for Playwright
npm run test:e2e           # Playwright, offline: fake Anthropic/OpenAI in e2e/mock-api.ts, throwaway database
npm run scan               # personal-data and secret scan (see "Never commit")
```
All tests run without network access or API keys. Never point tests at real APIs.

## Map
- `app/(auth)/` welcome + password, login · `app/(setup)/setup/*` first-run guide · `app/(app)/*` the app
  (`written`, `oral`, `flashcards`, `history`, `errors`, `settings`, `session/[id]`) · `app/api/*` route handlers.
- `lib/` server logic: `db.ts` (schema, runs on every boot), `auth.ts`, `settings.ts` (password, encrypted keys),
  `claude.ts` (structured calls), `ee.ts` / `eo.ts` (Written / Oral prompts and schemas), `consignes.ts` (Écrite
  prompts), `correct.ts`, `errors.ts`, `cards.ts` + `cardrules.ts` (flashcards), `onboarding.ts`, `scale.ts`.
- `data/` correction method and task structure (read by the correction prompt) and the original prompt bank.
- `docs/` install guide, API keys, formats, architecture, QA checklist.

More detail: `docs/architecture.md`.

## Rules (don't break these)
1. **Next.js 16**: read the guide in `node_modules/next/dist/docs/` before using a Next API (see the block above).
2. **Every page calls `requirePage()` and every API route calls `guard()`** (`lib/auth.ts`). Layouts alone do not
   protect pages in the App Router.
3. **Claude calls use structured output** via `output_config.format` (`lib/claude.ts`). Never a forced
   `tool_choice` — the models used here reject it with a 400.
4. **`lib/db.ts` SCHEMA is split on semicolons**: never put `;` inside an SQL comment there. Every statement must be
   safe to run on every boot (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, idempotent `UPDATE … WHERE`).
5. **Never rename stored JSON keys or values** (`faux`, `regle`, `version_b2`, `simulado`, localStorage keys
   `tcf-ee-v2`, `tcf-eo-topics-v1`): existing installs have data in them.
6. **Mobile first**: grids use `minmax(0, 1fr)`; check 375 px wide with no horizontal scroll, in light and dark mode
   (`npm run test:e2e` covers it). Styles live in `app/globals.css` (design tokens at the top); no gradients or shadows. Motion is short and answers
   the user (see "motion" in `globals.css`); it must stop under `prefers-reduced-motion` (`e2e/motion.spec.ts`).
7. **Oral turn-taking is tuned per tâche** (`app/api/eo/token`, `REPLY` in `app/(app)/oral/Oral.tsx`): T1 replies after a
   real silence, T2 replies quickly, T3 stays silent. Change only the tâche you are fixing.
8. Keep the exam material in French and everything else in English.

## Never commit
- Personal data: someone's texts, transcripts, history, names, emails, API keys, passwords, `SESSION_SECRET`,
  database URLs, `.env*` files (except `.env.example`), `.data/`.
- Prompts copied from books, PDFs or prep websites: they belong to their authors. Users import their own prompts
  through Settings → Prompt pack (`docs/formats.md`); the shipped bank (`data/consignes/bank.json`) is original.
- Run `npm run scan` before committing. CI also runs gitleaks.

## Helping someone install TCF Prep
If a person asks you to help them install or deploy the app, guide them through **`docs/install.md`**, in order:
- One step per message. Tell them exactly where to click, give the direct link, and say what they should see.
  Ask them to confirm (or describe what they see) before moving on. Don't skip steps.
- **Never ask them to paste a password, an API key, `SESSION_SECRET` or a database URL into the chat.** They paste
  those directly into Vercel or into the app. If they paste one by mistake, tell them to revoke it and create a new one.
- They don't need to know how to code. Avoid jargon; explain any term you have to use in a few words.
- If you have a terminal, you may use the Vercel CLI as an alternative path, but never type secrets yourself.
- When something doesn't match the guide (screens change), say so, adapt, and suggest they report it as an issue.
- The goal is reached when they open their own `https://…vercel.app` address on their phone, log in and see the
  dashboard. The app's own setup guide then walks them through API credits and keys.
