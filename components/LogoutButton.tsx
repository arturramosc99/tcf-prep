'use client';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  return (
    <button className="menu-btn" onClick={async () => { await fetch('/api/logout', { method: 'POST' }); router.replace('/login'); router.refresh(); }}>
      Log out
    </button>
  );
}
