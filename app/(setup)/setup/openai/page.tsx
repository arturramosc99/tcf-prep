import { requirePage } from '@/lib/auth';
import { keyStatus } from '@/lib/settings';
import { KeyStep } from '../KeyStep';
import { Steps } from '../Steps';

export const dynamic = 'force-dynamic';

export default async function SetupOpenAI() {
  await requirePage({ setup: true });
  const status = await keyStatus('openai');
  return (
    <div className="grid split">
      <section className="stack reading">
        <span className="label">Setup · step 3 of 4</span>
        <h1 className="title">Connect OpenAI <span className="muted">(Oral only)</span></h1>
        <p>In the Oral simulation an examiner talks with you through OpenAI&apos;s realtime voice model, which also transcribes what you
          say. Only the Oral needs this, so you can skip it now and add it later in Settings. <b>ChatGPT Plus or Pro doesn&apos;t cover the API</b> either.</p>
        <Steps items={[
          <>Open <a href="https://platform.openai.com" target="_blank" rel="noreferrer">platform.openai.com</a> and create an account (or log in).</>,
          <>Go to <b>Settings → Billing</b>, add a payment method and buy credits. US$5–10 is enough to try a few Oral simulations.</>,
          <>Recommended: in <b>Settings → Limits</b>, set a monthly budget.</>,
          <>Go to <b>API keys → Create new secret key</b>, name it “TCF Prep” and copy it. It starts with <code>sk-</code>.</>,
          <>Paste it here. The app tests it before saving.</>,
        ]} />
        <p className="tone warn"><span className="label">What it costs · </span>roughly US$1–3 per 12-minute Oral simulation, depending on how much you speak.
          This is an estimate: check your usage page on platform.openai.com after your first one.</p>
      </section>
      <KeyStep provider="openai" initial={status} next="/setup/start" title="OpenAI"
        use="The examiner's voice in the Oral exam (Realtime) and the transcript of your speech."
        where="platform.openai.com → API keys" placeholder="sk-…"
        skipNote="Written practice and flashcards work without it." />
    </div>
  );
}
