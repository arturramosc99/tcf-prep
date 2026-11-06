import { Tip } from '@/components/Tip';
import { requirePage } from '@/lib/auth';
import { Oral } from './Oral';

export const dynamic = 'force-dynamic';

export default async function OralPage() {
  await requirePage();
  return (
    <div className="grid">
      <Tip id="oral">Use headphones so the examiner doesn&apos;t hear itself, and allow the microphone when your browser asks. Speak as you would
        on exam day: the examiner never corrects you; the correction comes at the end from the transcript.</Tip>
      <Oral />
    </div>
  );
}
