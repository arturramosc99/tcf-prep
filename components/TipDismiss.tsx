'use client';
import { useRouter } from 'next/navigation';

export function TipDismiss({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button className="menu-btn" type="button" onClick={async () => {
      await fetch('/api/onboarding', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dismissTip: id }) });
      router.refresh();
    }}>Got it</button>
  );
}
