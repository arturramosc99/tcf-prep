import { ViewTransition } from 'react';

/** Navigation transition type for moving to the next step of a sequence (the setup guide): slides instead of fading. */
export const FORWARD = ['nav-forward'];

/**
 * Wraps the pages of a route group (used by each group's template.tsx, which re-mounts on every navigation).
 * Moving between pages becomes a short fade-and-rise instead of a cut; see the "motion" section of globals.css.
 * Updates inside a page (refreshes, state changes) are not animated here.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{ 'nav-forward': 'step-in', default: 'page-in' }}
      exit={{ 'nav-forward': 'step-out', default: 'page-out' }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
