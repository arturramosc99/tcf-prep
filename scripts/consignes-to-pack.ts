// Converts a numbered prompt file into a prompt pack you can import in Settings → Prompt pack.
// Input: { "t1": { "1": "…" }, "t2": { … }, "t3": { "1": { "titre", "doc1", "doc2" } } }
// Usage: npx tsx scripts/consignes-to-pack.ts <input.json> <output.json> [prefix]
// Keep both files outside the repository if the prompts are not yours to publish.
import fs from 'node:fs';
import { packFromNumbered } from '../lib/consignes';

const [input, output, prefix = 'pack'] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: npx tsx scripts/consignes-to-pack.ts <input.json> <output.json> [prefix]');
  process.exit(1);
}
const pack = packFromNumbered(JSON.parse(fs.readFileSync(input, 'utf8')), prefix);
fs.writeFileSync(output, JSON.stringify(pack, null, 1));
console.log(`${pack.items.length} prompts written to ${output} (prefix "${prefix}").`);
