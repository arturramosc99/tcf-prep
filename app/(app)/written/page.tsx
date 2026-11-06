import { Tip } from '@/components/Tip';
import { requirePage } from '@/lib/auth';
import { Written } from './Written';

export const dynamic = 'force-dynamic';

export default async function WrittenPage() {
  await requirePage();
  return (
    <div className="grid">
      <Tip id="written">The timer starts when you click Start and never pauses, as in the exam. Your draft is saved in this browser, so reloading is safe.
        There is no spell-checker: use the accent buttons under each field.</Tip>
      <Written />
    </div>
  );
}
