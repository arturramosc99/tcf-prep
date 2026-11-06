# Install TCF Prep (your own copy, online)

You'll end up with your own TCF Prep at an address like `https://tcf-prep-yourname.vercel.app`, which works on
your phone, tablet and computer. It takes about 20 minutes and you don't need to know how to code.

**What you need:** an email address and a payment card (for the AI credits in the last part; GitHub, Vercel and
Neon are free for this use).

**Want help?** Paste this into any AI assistant (ChatGPT, Claude, Gemini…) and let it guide you step by step:

> I want to install TCF Prep. Read https://github.com/arturramosc99/tcf-prep/blob/main/AGENTS.md and
> https://github.com/arturramosc99/tcf-prep/blob/main/docs/install.md and guide me one step at a time.
> I'm not technical. Never ask me to paste passwords or keys into this chat.

*Last checked against the GitHub, Vercel and Neon screens: November 2026. Screens change; if something looks
different, look for the same words nearby.*

---

## 1. Create a GitHub account and copy the app
GitHub stores the app's code. Your copy is called a **fork**.

1. Go to [github.com/signup](https://github.com/signup) and create a free account (skip if you have one).
2. Open [github.com/arturramosc99/tcf-prep](https://github.com/arturramosc99/tcf-prep).
3. Click **Fork** (top right), then **Create fork**.

✅ You now see `yourname/tcf-prep` at the top of the page.

## 2. Create a Vercel account
Vercel runs the app on the internet.

1. Go to [vercel.com/signup](https://vercel.com/signup).
2. Choose **Hobby** (free, personal use) and **Continue with GitHub**. Accept the permissions.

✅ You see your Vercel dashboard.

## 3. Import your copy into Vercel
1. Go to [vercel.com/new](https://vercel.com/new).
2. Under **Import Git Repository**, find **tcf-prep** and click **Import**.
   - Don't see it? Click **Adjust GitHub App Permissions**, give Vercel access to `tcf-prep`, come back.
3. On the **Configure Project** screen, leave everything as it is **except** the next step. Don't click Deploy yet.

<a id="session-secret"></a>
## 4. Add your secret (SESSION_SECRET)
This long random text protects your login and encrypts your API keys. You never type it again, but keep it.

1. Create a random password of **at least 40 characters** (letters and numbers):
   - easiest: your password manager's "generate password" (Apple Passwords, 1Password, Bitwarden…), set to 40+ characters;
   - or, if you use a terminal: `openssl rand -base64 48`.
2. Save it in your password manager as "TCF Prep SESSION_SECRET".
3. Back on Vercel, open **Environment Variables**. Key: `SESSION_SECRET`. Value: paste the secret. Click **Add**.
   It applies to every environment (Production and Preview), which is what you want.
4. Click **Deploy**.

✅ After about a minute you see "Congratulations". The app opens on a page saying **Database not connected** — that's
expected, it's the next step.

*Forgot to add it, or added it later?* Project → **Settings → Environment Variables** → make sure `SESSION_SECRET`
is ticked for **Production** and **Preview** → then redeploy (step 6).

<a id="database"></a>
## 5. Create the database
Neon stores your simulations, errors and (encrypted) keys.

1. In your project on Vercel, open the **Storage** tab → **Create Database**.
2. Choose **Neon** (Serverless Postgres) → **Continue**.
3. Accept Neon's terms, pick the region closest to you and the **Free** plan → **Create**.
4. On **Connect Project**, keep Production, Preview and Development ticked → **Connect**.

✅ In **Settings → Environment Variables** you now see `DATABASE_URL` (and a few `PG…` variables).

## 6. Redeploy
New settings only apply to a new deployment.

1. Open the **Deployments** tab.
2. On the top deployment, click **⋯** → **Redeploy** → **Redeploy**.

✅ Status **Ready** after about a minute.

## 7. Open your app and create your password — right away
1. On the project's **Overview**, under **Domains**, click your address (`tcf-prep-….vercel.app`).
   Use this short address: the long ones with random letters are previews that Vercel keeps private.
2. You see **Welcome**. Create your password now (anyone who opened your address before you could otherwise
   create it). Save it in your password manager.
3. The app's own guide takes over: buying API credits, creating your Claude and OpenAI keys
   ([details](api-keys.md)) and your first simulation.

✅ You see the dashboard.

## 8. Put it on your phone
1. Open your address in Safari (iPhone) or Chrome (Android) and log in.
2. iPhone: **Share → Add to Home Screen**. Android: **⋮ → Add to Home screen**.
3. The first time you start an Oral simulation, allow the microphone. Use headphones.

---

## Later

**Updates.** When the original project gets fixes: open your fork on GitHub → **Sync fork** → **Update branch**.
Vercel deploys the update by itself within a minute. See [updating.md](updating.md).

**Forgot your password?** Vercel → Settings → Environment Variables → add `APP_PASSWORD` with a new password →
redeploy. That becomes your password for as long as the variable exists.

**Change or remove an API key:** in the app, **Settings**.

**Your own domain (optional):** Vercel → Settings → **Domains** → Add.

**Something went wrong?**
- "Database not connected": step 5 wasn't finished, or you didn't redeploy (step 6).
- A yellow box about `SESSION_SECRET` on the Welcome page: step 4 wasn't done for Production; fix it, then redeploy.
- "Your Claude key was rejected" or "no credits left": check your balance at
  [console.anthropic.com](https://console.anthropic.com) → Billing.
- The Oral says it can't connect the voice: check your OpenAI key and credits, your internet, and that the
  browser is allowed to use the microphone.

---

## Option B: one-click Deploy button
The README has a **Deploy with Vercel** button that copies the repository, creates the database and asks for
`SESSION_SECRET` in one flow. It's quicker, but your copy is not a GitHub fork, so you can't use **Sync fork**
for updates (you'd copy changes by hand). If you're not technical, prefer the steps above.
