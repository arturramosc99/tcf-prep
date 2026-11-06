import { requirePage } from '@/lib/auth';
import { keyStatus } from '@/lib/settings';
import { KeyStep } from '../KeyStep';
import { Steps } from '../Steps';

export const dynamic = 'force-dynamic';

export default async function SetupClaude() {
  await requirePage({ setup: true });
  const status = await keyStatus('anthropic');
  return (
    <div className="grid split">
      <section className="stack reading">
        <span className="label">Setup · step 2 of 4</span>
        <h1 className="title">Connect Claude</h1>
        <p>Claude, Anthropic&apos;s AI, corrects your texts and your spoken answers. You pay Anthropic directly for what you use, with prepaid
          credits. <b>A Claude.ai Pro or Max subscription doesn&apos;t cover this</b> — the API is billed separately.</p>
        <Steps items={[
          <>Open <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a> and create an account (or log in).</>,
          <>Go to <b>Billing → Buy credits</b>. US$5–10 is plenty to start. Anthropic sets the minimum and the prices; credits expire after a year.</>,
          <>Recommended: in <b>Settings → Limits</b>, set a monthly spend limit so there are no surprises.</>,
          <>Go to <b>API Keys → Create Key</b>, name it “TCF Prep” and copy it. It starts with <code>sk-ant-</code> and is shown only once.</>,
          <>Paste it here. The app tests it, then stores it encrypted in your own database.</>,
        ]} />
        <p className="tone good"><span className="label">What it costs · </span>about US$0.10–0.20 per Written correction, a similar amount per Oral correction, and a few cents to write new Oral topics.</p>
      </section>
      <KeyStep provider="anthropic" initial={status} next="/setup/openai" title="Claude (Anthropic)"
        use="Corrects your Written and Oral simulations and creates the Oral topics."
        where="console.anthropic.com → API Keys" placeholder="sk-ant-…"
        skipNote="Without a Claude key nothing can be corrected. You can add it later in Settings." />
    </div>
  );
}
