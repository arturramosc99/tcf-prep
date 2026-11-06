import { PageTransition } from '@/components/PageTransition';

/**
 * Animates moves between route groups (welcome → setup guide → app, log in / log out). Moves inside a group are
 * animated by that group's own template: React only runs an enter/exit animation when no new DOM element wraps it,
 * and each group's layout brings its own <main>.
 */
export default function RootTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
