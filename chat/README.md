# Chat stage: the resident-facing helper

A plain chat page where **the editor's tree is the backend**. The squares and arrows drawn in the team
editor (`app/`, deployed as the Worker) are the only data. Code walks that graph; models only read, phrase,
and review.

How a turn works (`lib/turn.ts`):

1. **Jev reads** the resident's message (`lib/judge.ts`): which arrow label leaving the current square it
   matches, or none; on the first message, whether it is about the electric bill at all; on every message,
   whether it is off topic or a goodbye, and its language. Jev only picks from options the arrows define,
   so editing the tree changes Jev's options with no other change.
2. **Code moves** along the picked arrows (`lib/tree.ts`). A square with arrows out is said and waited on.
   A square with none is an answer and ends the chat. "Either" or unlabeled arrows ride along. An empty
   square is a **hole**: the helper says the 2-1-1 line instead. An off-topic first message is declined
   in one reply and the chat closes.
3. **DeepSeek writes** the reply in the helper's voice from the square's text with the conversation as
   context (`lib/writer.ts`), then **Jev reviews** it: does it cover every point, add nothing, and ask
   exactly what the square asks? A code check first rejects any number or link not in the square (numbers
   the resident said are allowed). If either fails, the square's verbatim text is sent. The review is
   stored on the message and shown in the inspector.

The tree file is `data/tree.json` (export of the live editor: sign in to the editor site and open
`/api/tree/main/export`, then Import in the inspector) or `data/tree.seed.json` (the seed) when absent.
It is re-read whenever the file changes.

## Inspector

`/admin` is the tree, read-only, with chats drawn on it. Every reply a chat produced appears as a bubble
beside the square it came from: the resident's message that led there, the helper's reply, the Jev review
(written or verbatim), and **↻ rerun from here**. In list mode every listed chat is on the canvas, one
column per chat. Pick a chat and only it is shown; its path gets step numbers. A rerun replays the
resident's messages up to that reply through the *current* tree, lets the simulated resident finish, and
appears as a second column beside the original, saved as a new chat linked to its parent. The panel on
the right (toggle with the icon top right, resize, expand, pop out) lists chats and shows the selected
transcript with a back link. **+ Run** starts a scenario against the current tree. **Import tree…** takes
the editor's export JSON. Archived chats leave the lists but keep their links; `bun scripts/archive.ts
--keep 3` archives everything else, and the "archived" checkbox shows them again.

## Tests

| Command | What |
|---|---|
| `bun test` | unit tests: tree semantics, the code check, the walker with a scripted reader (no network) |
| `bun scripts/mutate.ts` | mutation testing: 20 one-line bugs in `lib/`, all must be caught by `bun test` |
| `bun scripts/e2e.ts` | end to end on a scratch port and database with real Jev and DeepSeek: decline, urgent, answer, hole, ended chat, inspector API, import, rerun, the inspector page in a headless browser |
| `python3 scripts/audit.py` | every number and link in every saved reply exists in the tree; wording stats |

## Run

```bash
cd chat
cp .env.example .env      # put the OpenRouter key in; the one used for testing is already in .env on this machine
bun server.ts             # http://localhost:8972
```

| Page | What |
|---|---|
| `/` | the chat. Starter chips for the opening question and a few common ones. |
| `/c/:id` | a saved chat, read-only transcript, with "Start your own chat" and a plain-text link. Sending a message continues it. |
| `/chats` | every shared chat on this server; `?all=1` includes unshared ones. |
| `/admin` | the inspector. |
| `/api/tree` | the tree in use plus holes / unreachable report. `POST /api/tree/import` replaces it. |
| `/api/admin/chats` | every chat with, per reply, the squares it came from, the verbatim text, and the review. |
| `/api/chats/:id/rerun` | `POST {seq}` rerun from that reply. `POST /api/admin/new {scenario}` runs a scenario. |

Press **Share** to mark the chat shared and copy its link. The link is the chat id in the URL, so it also
works before pressing Share; Share just lists it on `/chats`. Links point at `PUBLIC_ORIGIN` from `.env`.

## Files

| File | Notes |
|---|---|
| `server.ts` | Bun HTTP server, SSE streaming from OpenRouter, REST for chats |
| `lib/tree.ts` | loads the editor document; derives steps, answers, options, holes, reachability |
| `lib/turn.ts` | one resident message in, one reply out; walks the tree; used by the server and the simulator |
| `lib/judge.ts` | Jev reader (TypeSafe System One), DeepSeek JSON fallback, translator |
| `lib/writer.ts` | DeepSeek wording of a square + code check + Jev review |
| `public/admin.html` | the inspector |
| `lib/llm.ts` | OpenRouter client: `complete()` and streaming `stream()` |
| `lib/db.ts` | `bun:sqlite` store, tables `chats` and `messages`; file at `data/chats.sqlite` (gitignored) |
| `scripts/simulate.ts` | scenarios; `runScenario`, `continueChat`, `rerunFrom` used by the inspector |
| `data/samples/*.md` | transcripts of the last simulation run plus `README.md` with the share links |
| `.env` | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `SIM_MODEL`, `TYPESAFE_API_KEY`, `TYPESAFE_MODEL`, `PORT`, `PUBLIC_ORIGIN`, `DB_PATH` |

Model: `deepseek/deepseek-v4-flash`, about $0.05 per million input tokens. The tree is ~22k characters,
so one full conversation costs well under a cent.

## Sample chats

```bash
bun scripts/simulate.ts               # all 24 scenarios, 10 resident turns each, 4 in parallel
bun scripts/simulate.ts --only scam-call --turns 6
bun scripts/simulate.ts --list
```

Each scenario in `scripts/simulate.ts` targets one branch or edge of the tree: PIPP with electric vs gas
heat, disconnection notice, medical equipment, power already off, NOVEC customer, over income, EnergyShare
via a payment-plan slip, "why did my bill go up", scam call, renter vs owner weatherization, veteran senior,
Budget Billing while behind, cooling window closed, Fuel Assistance dates, Spanish speaker, a social worker
asking on behalf of a client, cash income with no documents, an off-topic water bill, a one-word "help",
City-vs-County Alexandria confusion, and stacking programs. Add a scenario by adding an object to `SCENARIOS`.

Every run saves the chats to SQLite (source `simulate`, labeled with the scenario), marks them shared, writes
one markdown transcript per scenario to `data/samples/`, and prints the links.

## Checking a run

The point of the tree is that the helper never invents a number. After a run, this compares every phone
number and link the helper said against the tree file and flags leaked source tags:

```bash
python3 scripts/audit.py
```

## Known gaps (as of 2026-09-27)

- Whoever has the link can read or continue the chat. Fine for a local demo, not for the public.
- The helper sometimes asks two screener questions in one message despite the rule.
- It sometimes skips the "Dominion or NOVEC?" question when the resident already sounds like a Dominion customer.
- Long chats send the whole tree every turn. Fine at this price; cache or trim later.
- The tree comes from the markdown file, not from the live tree editor. `TREE_FILE=path` overrides the file;
  wiring the editor's `/api/tree/main/export` in is the next step once it has a service token.
