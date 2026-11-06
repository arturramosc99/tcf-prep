# Contributing

Thanks for helping! Bug reports, fixes, better prompts and translations of the docs are welcome.

1. Fork the repository and create a branch.
2. `npm ci`, then `npm run dev`. No keys or database are needed to develop (see `docs/local-development.md`).
3. Read **`AGENTS.md`**: it has the rules of the codebase. AI coding assistants (Codex, Claude Code, Cursor…)
   read it automatically; `CLAUDE.md` just points to it.
4. Before opening a pull request:
   ```bash
   npm run lint && npm run typecheck && npm run test:unit && npm run test:e2e && npm run scan
   ```
5. If you changed something visible, run through `docs/qa/checklist.md` for that area.

**Never include** personal texts, transcripts, keys, or prompts copied from books, PDFs or prep websites.
The shipped prompt bank (`data/consignes/bank.json`) only accepts original prompts.
