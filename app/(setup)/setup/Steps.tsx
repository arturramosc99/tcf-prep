/** Numbered how-to list used by the setup guide. */
export function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="steps">
      {items.map((it, i) => <li key={i}><span className="kicker">{String(i + 1).padStart(2, '0')}</span><div>{it}</div></li>)}
    </ol>
  );
}
