# Manual release checklist

Copy this list into the release issue/PR and tick it. Write what you used (device, browser, AI assistant).

## A. Install from zero (every big release, and when Vercel/Neon screens change)
Use a throwaway GitHub account and a throwaway Vercel account. Don't use your own keys if you can avoid it:
put US$5 on a separate Anthropic/OpenAI account or reuse yours with a low spend limit.
- [ ] Paste the README's "guide me" prompt into an AI assistant that is **not** the one you develop with, and follow
      only what it says plus `docs/install.md`.
- [ ] The assistant never asks you to paste a secret into the chat.
- [ ] Fork → Vercel import → `SESSION_SECRET` → deploy → "Database not connected" page appears.
- [ ] Neon via Storage → redeploy → the **short** production address opens the Welcome page (not a Vercel login).
- [ ] Welcome shows no `SESSION_SECRET` warning. Create the password.
- [ ] Setup guide: links open the right provider pages; a wrong key shows an error; a real key says Connected.
- [ ] Tour → "Start a Written simulation" works.
- [ ] Add to Home Screen on a phone; it opens and stays logged in.
- [ ] Every place where the guide didn't match the screens is fixed in `docs/install.md` (update "Last checked").
- [ ] Deploy button (README): it asks for `SESSION_SECRET`, creates the Neon database, and the app opens.
- [ ] Sync fork: push a trivial change upstream; the fork's **Sync fork** shows it and Vercel redeploys.

## B. Real voice (Oral) — on a laptop and on an iPhone
- [ ] Microphone prompt appears; refusing it shows the "No microphone access" message.
- [ ] T1: the examiner asks one short question at a time (~10 words); waits for a real pause; sometimes interrupts a
      long answer politely (not every simulation).
- [ ] T2: 2 minutes of preparation with notes; notes stay visible during the conversation; the examiner answers in
      one short sentence and never asks questions back.
- [ ] T3: the examiner reads the topic and then stays silent until the end.
- [ ] iPhone Safari: the examiner's voice is audible (audio unlock), headphones work, the screen doesn't zoom on inputs.
- [ ] The transcript and the correction arrive; "You said / More natural" makes sense.
- [ ] Note the real cost of one Oral (OpenAI usage page) and update the estimate in the README and docs if needed.

## C. Real corrections (with real keys, once per release)
- [ ] A Written simulation is corrected in under 4 minutes; the explanation is in English, the rewrite in French.
- [ ] Errors link to existing patterns (watch the Errors page counts).
- [ ] New flashcards appear and make sense; badly generated ones can be archived.
- [ ] When the bank runs out (or after importing nothing), a Claude-written prompt looks like a real TCF prompt.

## D. Phone and accessibility
- [ ] iPhone (Safari) and Android (Chrome), light and dark: dashboard, Written (typing with the accent keys), Oral
      intro, a session, Flashcards (typing), Settings. Nothing cut off, nothing overlapping.
- [ ] Keyboard only on desktop: Tab reaches every button and link with a visible focus ring; Escape-free flows.
- [ ] Screen reader spot check (VoiceOver): nav "Sections", the timer, the errors table, French text read in French.
- [ ] Contrast: traffic-light colours (good/warn/bad) readable in both modes.
- [ ] Motion on a real phone (iPhone Safari and Android Chrome): moving between sections fades smoothly with the
      header still; setup steps slide forward; a slow page shows placeholders; the correction dial sweeps. With
      "Reduce motion" on (iOS: Settings → Accessibility → Motion), nothing slides or spins.

## E. Upgrade of an existing install
- [ ] Deploy over an install that has data: no setup guide, no tips, sessions/errors/cards still there, old sessions
      open, "Correct again" works on an old session.

## F. Before publishing
- [ ] `npm run scan` and `gitleaks git .` clean; [security.md](security.md) log updated.
- [ ] README screenshots regenerated (`npm run screenshots`) if the UI changed.
