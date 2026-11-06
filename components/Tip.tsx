import { getOnboarding, tipVisible } from '@/lib/onboarding';
import { TipDismiss } from './TipDismiss';

/** A short hint shown the first time a page is opened, until dismissed. */
export async function Tip({ id, children }: { id: string; children: React.ReactNode }) {
  if (!tipVisible(await getOnboarding(), id)) return null;
  return (
    <aside className="card soft tip" aria-label="Tip">
      <span className="label">Tip</span>
      <p>{children}</p>
      <TipDismiss id={id} />
    </aside>
  );
}
