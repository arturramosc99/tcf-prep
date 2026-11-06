'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/written', label: 'Written' },
  { href: '/oral', label: 'Oral' },
  { href: '/flashcards', label: 'Flashcards' },
  { href: '/history', label: 'History' },
  { href: '/errors', label: 'Errors' },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Sections">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={(l.href === '/' ? path === '/' : path.startsWith(l.href)) ? 'page' : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
