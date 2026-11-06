# Security review checklist

Run before every release that touches authentication, keys, the database or a new API route. Write the date and
the result in the log at the bottom.

| # | Check | How | Expected |
| --- | --- | --- | --- |
| S1 | Every API route calls `guard()` | `e2e/auth.spec.ts` lists every route; add new ones there | 401 JSON when logged out |
| S2 | Every page calls `requirePage()` | `e2e/auth.spec.ts` PAGES | redirect to /login |
| S3 | Password | `lib/settings.ts` | scrypt + salt; `timingSafeEqual`; min 10 chars on creation |
| S4 | Brute force | `app/api/login/route.ts` | 8 wrong tries per IP / 40 total per 15 min → 429 |
| S5 | Session cookie | `lib/auth.ts` | httpOnly, secure in production, sameSite=lax, HMAC-SHA256, 90-day expiry |
| S6 | CSRF | SameSite=lax: cookies are not sent on cross-site POSTs; APIs only accept POST/PATCH for writes | no state change from another site |
| S7 | API keys at rest | `lib/settings.ts` | AES-256-GCM, key from `SESSION_SECRET` (outside the DB); never returned in full (`mask`) |
| S8 | Keys in transit | `app/api/eo/token` | the browser only gets an ephemeral Realtime key |
| S9 | Keys in logs/errors | grep `console.` and error messages | no key or secret is logged or stored in `sessions.error` |
| S10 | SQL injection | grep for `${` in SQL | only constants or `$n` placeholders are interpolated |
| S11 | XSS | grep `dangerouslySetInnerHTML` | none; React escapes all text |
| S12 | Input limits | `lib/consignes.ts`, `lib/cards.ts`, `api/onboarding` | pasted prompt fields ≤ 2,500 chars; packs ≤ 5,000 items; tip ids, timezone, target validated |
| S13 | Malformed ids | `e2e/progress.spec.ts` | clean 404, not 500 |
| S14 | Headers | `next.config.ts` | CSP (self + api.openai.com), frame-ancestors none, nosniff, Permissions-Policy microphone only |
| S15 | First access | `/welcome` | password can only be created while none exists; guide says to create it right after deploy |
| S16 | Dependencies | `npm audit --omit=dev` | 0 vulnerabilities in production dependencies |
| S17 | Secrets in the repository | `npm run scan`, `gitleaks git .`, CI gitleaks | nothing found |
| S18 | GitHub settings | repo → Settings → Code security | secret scanning + push protection on, Dependabot alerts on, `main` protected |

## Log
- **2026-11-04** — full review before going public. S1–S17 pass. Fixed during the review: pack size limits (S12),
  malformed session ids returned 500 (S13). Known and accepted: CSP allows `'unsafe-inline'` scripts (needed by
  Next.js inline bootstrapping); dev-only dependencies (eslint → minimatch) have moderate ReDoS advisories that
  don't ship to production. gitleaks over the whole private history: no leaks. S18 is done when the repository is
  made public.
