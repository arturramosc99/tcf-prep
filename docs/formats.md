# Pack formats

Both are imported in **Settings**. Items already imported are skipped, so importing the same file twice is safe.

## Prompt pack (Expression écrite)
Add prompts you own (from a book or course you bought, or written by you) to the ones the app draws from.
Don't share packs made from copyrighted material.

```json
{
  "version": 1,
  "kind": "consignes",
  "prefix": "book",
  "items": [
    { "tache": 1, "num": 1, "texte": "Vous organisez… (60 mots minimum / 120 mots maximum)" },
    { "tache": 2, "num": 1, "texte": "Vous avez participé… (120 mots minimum / 150 mots maximum)" },
    { "tache": 3, "num": 1, "titre": "Faut-il… ?", "doc1": "Premier document…", "doc2": "Second document…" }
  ]
}
```
- `prefix`: 2–20 lowercase letters naming the pack (not `bank`, `ai` or `own`). Each prompt's id is `prefix-t{tache}-{num}`.
- `tache` 1 and 2 need `texte`; tâche 3 needs `titre`, `doc1` and `doc2`. Each field up to 2,500 characters.
- Have a file numbered like `{ "t1": { "1": "…" }, "t2": {…}, "t3": { "1": { "titre", "doc1", "doc2" } } }`?
  Convert it: `npx tsx scripts/consignes-to-pack.ts input.json pack.json book`.

## Flashcard pack
```json
{
  "version": 1,
  "cards": [
    { "kind": "phrase", "prompt": "Je ___ au marché demain.", "answer": "vais", "wrong": ["va", "vas"],
      "rule": "aller, 1st person singular: je vais", "pattern_slug": "verb-conjugation" },
    { "kind": "mot", "prompt": "___", "hint": "you wrote “a”", "answer": "à", "wrong": ["a", "á", "â"],
      "rule": "The preposition à takes a grave accent." },
    { "kind": "phrase", "prompt": "Fix: «les gens qui je connais»", "answer": "les gens que je connais",
      "wrong": ["les gens qui je connais"], "rule": "que when the pronoun is the object." }
  ]
}
```
- `kind`: `mot` (one word) or `phrase`. A `phrase` prompt has exactly one `___`, or starts with `Fix:`.
- `wrong`: 1 to 3 distractors, none equal to the answer. `hint` and `pattern_slug` are optional; a `pattern_slug`
  links the card to one of your error patterns if it exists.
