# Security

## How TCF Prep protects your data
- **One user per install.** Each person runs their own copy with their own database. Nobody else's install can
  see your data, and the original author has no access to yours.
- **Password:** hashed with scrypt; the login cookie is httpOnly, `secure` in production, `sameSite=lax`, and signed
  with HMAC-SHA256. Wrong passwords are rate-limited per IP and globally (15-minute window).
- **API keys:** tested before saving, encrypted with AES-256-GCM using a key derived from `SESSION_SECRET`, used
  only on the server, never sent back in full. Keep `SESSION_SECRET` in Vercel, not in the database: then a database
  leak alone doesn't reveal your keys.
- **Voice:** the browser only receives a short-lived OpenAI Realtime key, never your real key.
- **Every API route checks the session** (`guard()`), every page too (`requirePage()`).
- **Headers:** Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and a
  Permissions-Policy that only allows the microphone.
- **Repository hygiene:** no personal data or keys are committed; CI runs gitleaks on every push.

## Your part
- Add `SESSION_SECRET` (step 4 of `docs/install.md`) and create your password right after deploying.
- Set monthly spend limits at Anthropic and OpenAI.
- Never paste keys or passwords into chats, issues or emails. If a key leaks, revoke it on the provider's site.
- Keep your fork updated (`docs/updating.md`).

## Reporting a vulnerability
Please don't open a public issue. Use GitHub's **Security → Report a vulnerability** on this repository to send a
private report. You'll get an answer as soon as possible.
