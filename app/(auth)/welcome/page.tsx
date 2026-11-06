import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAuthed } from '@/lib/auth';
import { dbProblem } from '@/lib/db';
import { passwordConfigured, secretInEnv } from '@/lib/settings';
import { FORWARD } from '@/components/PageTransition';
import { LoginForm } from '../login/LoginForm';

export const dynamic = 'force-dynamic';

const GUIDE = 'https://github.com/arturramosc99/tcf-prep/blob/main/docs/install.md';

/** First visit of a fresh install: what the app is, what it costs, then the password (step 1 of the setup guide).
 * ?replay=1 (Settings → Replay the setup guide, logged in): the same screen with the password form shown but disabled. */
export default async function Welcome(props: PageProps<'/welcome'>) {
  if (await dbProblem()) redirect('/'); // the app layout explains how to connect the database
  const replay = (await props.searchParams).replay === '1';
  if (await passwordConfigured() && !(replay && (await isAuthed()))) redirect('/login');
  const secretMissing = Boolean(process.env.VERCEL) && !secretInEnv();
  return (
    <div className="grid split" style={{ width: '100%', maxWidth: 980 }}>
      <section className="stack reading">
        <span className="brand">TCF Prep</span>
        <span className="label">Setup · step 1 of 4</span>
        <h1 className="title">Welcome</h1>
        <p>Practise the TCF Canada <b lang="fr">Expression écrite</b> and <b lang="fr">Expression orale</b> in exam conditions, get every
          text and every spoken answer corrected by AI with a score out of 20 and an NCLC level, and turn your recurring mistakes into flashcards.</p>
        <table className="lines"><tbody>
          <tr><td className="label">You need</td><td>An Anthropic account with API credits (corrections). An OpenAI account with API credits only for the Oral. A Claude or ChatGPT subscription doesn&apos;t cover this: the API is paid separately.</td></tr>
          <tr><td className="label">Typical cost</td><td>About US$0.10–0.20 per Written correction. Roughly US$1–3 per 12-minute Oral (voice). Flashcards are free. You pay the AI providers directly; TCF Prep itself is free.</td></tr>
          <tr><td className="label">Your data</td><td>Stays in your own database. Keys are encrypted and only used by your server.</td></tr>
        </tbody></table>
        <p className="muted">The next screens walk you through buying credits, creating the two keys and your first simulation.</p>
        {secretMissing && (
          <p className="error-box">This install has no <code>SESSION_SECRET</code> yet. Add one before going further: <a href={`${GUIDE}#session-secret`}>install guide, step 4</a>.</p>
        )}
      </section>
      <div className="stack">
        <LoginForm create preview={replay} />
        {replay && (
          <section className="tone warn stack">
            <p>You&apos;re replaying the setup guide. Your password and your data don&apos;t change.</p>
            <Link href="/setup/claude" transitionTypes={FORWARD} className="btn solid" style={{ alignSelf: 'flex-start' }}>Continue</Link>
          </section>
        )}
      </div>
    </div>
  );
}
