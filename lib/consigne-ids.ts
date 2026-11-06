// Prompt ids, safe to use on the client (no database). See lib/consignes.ts for where prompts come from.

/** Sessions from older versions stored the prompt number of the "pdf" pack. */
export const legacyId = (tache: number, v: number | string) => (/^\d+$/.test(String(v)) ? `pdf-t${tache}-${Number(v)}` : String(v));

export function consigneLabel(id: string) {
  if (id.startsWith('bank-')) return `Bank #${Number(id.split('-').at(-1))}`;
  if (id.startsWith('ai-')) return 'AI-generated prompt';
  if (id.startsWith('own-')) return 'Your prompt';
  const m = id.match(/^([a-z]+)-t\d-(\d+)$/);
  return m ? `${m[1]} #${m[2]}` : id;
}
