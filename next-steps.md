# Next steps

*Written 2026-09-26.*

We're building a plain-language chat helper for Fairfax County residents who are Dominion Energy
customers and want to understand, pay, or get help with their electric bill. Bills are going up, help
exists, but it's scattered across agencies and websites and people don't know which option fits them
or who to call. The tool asks a few simple questions and points each person to the right option,
program, link, or phone number, using only verified sources.

We'll need to do three things. Write down what the tool is allowed to know as one document, a decision
tree with every answer sourced and dated. Write a short set of rules for how it behaves, such as urgent
cases first, plain words, never collect sensitive numbers. Then build a simple chat page that connects
those two to an AI model. No database and no web search, because the whole knowledge base fits in a
few pages.

So far we have a first decision tree for "rates went up, what can I do," covering PIPP and EnergyShare,
and a draft of the rules. Next we need to fill the tree's holes, meaning income limits, the LIHEAP
branch, verified dollar amounts, and Fairfax contact names, and build the chat page so we can test it
against 20 to 30 real resident questions. Name, tagline, logo and splash page are due October 2.
Summit demo is October 13.

## Status 2026-09-27: chat page built (local)

`chat/` is the chat page: DeepSeek through OpenRouter, system prompt = rules + tree + date, streaming
replies, every chat saved in full to a local SQLite file, share links at `/c/:id`, a gallery at `/chats`.
`bun scripts/simulate.ts` generates 24 sample conversations (one per branch or edge of the tree) and
`python3 scripts/audit.py` checks that every phone number and link the helper said exists in the tree.
See `chat/README.md`.

Update 2026-09-27 (night): tests in place (`bun test` 23 unit, `bun scripts/mutate.ts` 20/20 mutants
killed, `bun scripts/e2e.ts` 15 checks with real Jev + DeepSeek, all passing). The e2e run caught and
fixed one bug: importing a tree wrote to the wrong file when the server ran on an override path.
Inspector now draws every chat's bubbles on the canvas beside their squares, reruns appear as a parallel
column, and only the three review chats are unarchived.

Update 2026-09-27 (evening): the editor's tree is now the backend. `chat/lib/tree.ts` walks the squares
and arrows exported from the editor; Jev picks arrows; DeepSeek words each square and Jev reviews the
wording (verbatim square text on any failure); `/admin` is the inspector with path overlay and "rerun from
here". Three things the seed tree needs, all fixable in the editor: split the seven-question screener
square into seven squares; add a "No" arrow from the income square; make the branch squares steps (ask
"which of these?") or add a square per outcome instead of all six as one leaf. Then pull the live tree:
open `/api/tree/main/export` on the editor site while signed in, paste into Import in the inspector. To
make that a button, set `DEV_ORIGIN` to `http://localhost:8972` in `app/wrangler.jsonc` and redeploy.

Earlier that day: the free-form LLM flow produced noisy chats (re-asked answered questions, kept
going after an off-topic ask, never ended). Rebuilt so code owns the flow: `chat/lib/flow.ts` is the tree
as a state machine, Jev (TypeSafe) reads each message into typed picks, DeepSeek only answers side
questions and translates. Chats now end on their own: decline, urgent, scam, or result. Old samples are
in `chat/data/samples-archive/`; three new ones in `chat/data/samples/`. Next: review those three, then
run all 24 scenarios, then the 20 to 30 real resident questions. Known gaps: screener skips the
60+/under-5/disabled/veteran question (only unlocks the closed Cooling program and EnergyShare extras);
Branch F "why did it go up" offers the screener rather than ending; NOVEC customers get B2 + D only.

## Files

- `context/decision-tree-assistance.md` — the tree, rebuilt 2026-09-26 from official sources. Every claim carries a `[src: file]` tag and a VERIFIED / CHECK / UNVERIFIED mark. Work the "Open items for the team" list at the bottom.
- `context/human-edited/decision-tree-assistance.md` — the team's original tree, kept as-is.
- `context/sources/` — saved copies of every source page and PDF (see `MANIFEST.md` for URL, time, hash). Open the file named in a `[src: …]` tag to check a claim.
- `context/verification/` — independent claim-by-claim checks of the tree against the saved sources.
- `context/research/` — first-pass research notes (DeepSeek), not a source of truth.
- `context/system-prompt.md` — how the assistant behaves. `chat/lib/prompt.ts` appends the tree and today's date at runtime.
- `chat/` — the chat page, SQLite store, simulator, and sample transcripts in `chat/data/samples/`.
- `context/team-docs/` — the team PDFs, source of truth for the tree.
- `context/claude-chats/` — the claude.ai design chats this was distilled from.
