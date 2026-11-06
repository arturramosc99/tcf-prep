import { ViewTransition } from 'react';

/** Breathing placeholder bars (see .sk in globals.css). */
export function SkeletonLines({ n = 3 }: { n?: number }) {
  return <>{Array.from({ length: n }, (_, i) => <span key={i} className={`sk ${i === n - 1 ? 'short' : ''}`} />)}</>;
}

/** What a page looks like while it loads: a title, two cards and a wide one. Fades out when the page arrives. */
export function SkeletonPage() {
  return (
    <ViewTransition exit="skeleton-out" default="none">
      <div className="grid" aria-busy="true" aria-label="Loading">
        <span className="sk title" />
        <div className="grid two">
          <section className="card soft stack"><span className="sk short" /><span className="sk big" /><span className="sk" /></section>
          <section className="card soft stack"><SkeletonLines n={4} /></section>
        </div>
        <section className="card soft stack"><SkeletonLines n={3} /></section>
      </div>
    </ViewTransition>
  );
}
