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

## Files

- `context/decision-tree-assistance.md` — the tree, rebuilt 2026-09-26 from official sources. Every claim carries a `[src: file]` tag and a VERIFIED / CHECK / UNVERIFIED mark. Work the "Open items for the team" list at the bottom.
- `context/human-edited/decision-tree-assistance.md` — the team's original tree, kept as-is.
- `context/sources/` — saved copies of every source page and PDF (see `MANIFEST.md` for URL, time, hash). Open the file named in a `[src: …]` tag to check a claim.
- `context/verification/` — independent claim-by-claim checks of the tree against the saved sources.
- `context/research/` — first-pass research notes (DeepSeek), not a source of truth.
- `context/system-prompt.md` — how the assistant behaves. The app appends the tree and today's date at runtime.
- `context/team-docs/` — the team PDFs, source of truth for the tree.
- `context/claude-chats/` — the claude.ai design chats this was distilled from.
