# API keys and costs

TCF Prep is free. The AI it uses is not: you pay Anthropic and OpenAI directly, with prepaid credits, for what you
use. A **Claude.ai** or **ChatGPT** subscription does not include API usage — the API is a separate account.
The app's setup guide (after you create your password) walks you through this too.

| Provider | Used for | Needed? |
| --- | --- | --- |
| Anthropic (Claude) | Correcting Written and Oral simulations, writing Oral topics and new Écrite prompts | Yes |
| OpenAI | The Oral examiner's voice and the transcript of what you say | Only for the Oral |

## Anthropic (Claude)
1. [console.anthropic.com](https://console.anthropic.com) → sign up or log in.
2. **Billing → Buy credits.** US$5–10 is plenty to start. Credits are non-refundable and expire after a year.
3. **Settings → Limits** → set a monthly spend limit.
4. **API Keys → Create Key** → name it "TCF Prep" → copy it (starts with `sk-ant-`; shown once).
5. In TCF Prep: **Settings** (or the setup guide) → paste → **Test and save**.

**Cost:** about US$0.10–0.20 per Written correction with the default model (`claude-sonnet-5-5`); an Oral correction
costs about the same. Topics and new prompts cost a few cents.

## OpenAI
1. [platform.openai.com](https://platform.openai.com) → sign up or log in.
2. **Settings → Billing** → add a payment method → buy credits (US$5–10 to start).
3. **Settings → Limits** → set a monthly budget.
4. **API keys → Create new secret key** → name it "TCF Prep" → copy it (starts with `sk-`).
5. In TCF Prep: **Settings** → paste → **Test and save**.

**Cost:** roughly US$1–3 per 12-minute Oral simulation, depending on how much you speak. This is an estimate:
check **Usage** on platform.openai.com after your first simulation. To make it cheaper, set the Vercel variable
`REALTIME_MODEL=gpt-realtime-2.1-mini` and redeploy (the voice is a bit less natural).

## Safety
- Keys are tested before they are saved, stored encrypted (AES-256-GCM) in your own database, used only by your
  server, and never shown in full again.
- Never paste a key into a chat, an email or an issue. If you did, delete it on the provider's site and create a new one.
- Spend limits on both sites are your safety net: set them.
