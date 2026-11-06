import { requirePage } from '@/lib/auth';
import { keyStatus, secretInEnv } from '@/lib/settings';
import { KeyForm } from './KeyForm';
import { ImportPack } from './ImportPack';
import { Preferences } from './Preferences';
import { TranslateHistory } from './TranslateHistory';
import { pendingTranslation } from '@/lib/translate';

export const dynamic = 'force-dynamic';

export default async function Settings() {
  const o = await requirePage();
  const [anthropic, openai, pt] = await Promise.all([keyStatus('anthropic'), keyStatus('openai'), pendingTranslation()]);
  return (
    <div className="grid">
      <section className="stack reading">
        <h1 className="title">Settings</h1>
        <p className="muted">Keys are encrypted in the app&apos;s database and only used by the server; they are never shown in full. Each key is tested before it is saved.</p>
      </section>
      {process.env.VERCEL && !secretInEnv() && (
        <section className="error-box stack reading">
          <p><b>Extra protection recommended:</b> your keys are encrypted with a secret stored in the same database. To keep them apart, add a <code>SESSION_SECRET</code> variable in Vercel (Settings → Environment Variables, type Sensitive, for Production and Preview) with a long random text, then Redeploy. The app re-encrypts the keys by itself; you only need to log in again.</p>
        </section>
      )}
      <div className="grid two">
        <KeyForm provider="anthropic" initial={anthropic} title="Claude (Anthropic)" use="Corrects your Written and Oral simulations and creates the Oral topics."
          where="console.anthropic.com → API Keys" placeholder="sk-ant-…" />
        <KeyForm provider="openai" initial={openai} title="OpenAI" use="The examiner's voice in the Oral exam (Realtime) and the transcript of your speech."
          where="platform.openai.com → API keys" placeholder="sk-…" />
      </div>
      {pt.patterns + pt.cards + pt.sessions > 0 && <TranslateHistory {...pt} />}
      <Preferences target={o.target.nclc} timezone={o.timezone} />
      <div className="grid two">
        <ImportPack title="Prompt pack (Écrite)" endpoint="/api/consignes/import" noun="prompts"
          about="Adds your own Expression écrite prompts (.json) to the ones the app draws from — for example prompts from a prep book you own. Prompts already imported are skipped." />
        <ImportPack title="Flashcard pack" endpoint="/api/cards/import" noun="cards"
          about="Imports flashcards (.json) into Flashcards. Duplicates are skipped; progress on existing cards is kept." />
      </div>
    </div>
  );
}
