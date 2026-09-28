# ai-energy-tool GUI

Collaborative visual editor for the decision tree that powers the electric-bill chat helper.
Squares connected by arrows are the tree. Text and links live inside squares. Live at
**https://ai-energy-tool.mannanteam.workers.dev** (team password, then magic-link sign-in).

## How it is put together

| Piece | Where | Notes |
|---|---|---|
| UI | `src/` | Next.js 16 static export, React Flow 12, zustand |
| Worker | `worker/index.ts` | serves the static export, gates pages, auth API, routes WebSockets to the room |
| Auth | `worker/auth.ts` | `aet_gate` cookie (team password) + `aet_session` cookie (who you are), both HMAC-signed; magic-link tokens hashed in D1 |
| Email | `worker/email.ts` | Cloudflare Email Sending from `no-reply@skeleton.mannan.is` (already-onboarded domain); `EMAIL_PROVIDER=console` logs the link instead |
| Room | `worker/room.ts` | one Durable Object per tree (`TreeRoom`), Yjs document persisted to DO SQLite, seeds `main` with the example tree and any other room with a root square, `GET` returns a JSON snapshot |
| Trees | D1 table `tree` | the list of trees (id, name, who made it, and the R2 key of its source PDF) |
| Files | R2 bucket `ai-energy-tool-files`, binding `FILES` | source PDFs at `trees/<id>.pdf` |
| Shared state | `src/lib/store.ts` | Yjs maps `meta`, `nodes`, `edges`, `locks`; awareness carries user, cursor, editingNodeId |

Secrets on the Worker: `WORKSPACE_PASSWORD`, `SESSION_SECRET` (`wrangler secret put`). Local copies of
both live in the macOS keychain under `ai-energy-tool-workspace-password` and `ai-energy-tool-session-secret`.

## The chat plugin

The speech-bubble button in the toolbar shows chats on the canvas and opens the panel's **chats** tab. Chats
come from the chat server in `../chat` (`bun server.ts`, `NEXT_PUBLIC_CHAT_ORIGIN` in `.env.development`),
which walks this very tree: it reads the live document from the Worker's export route before every turn. Each
message is a draggable bubble beside the square its reply came from; bubble positions live in the shared
document (Yjs map `bubbles`). "rerun from here" replays a chat through the current tree. See `../chat/README.md`.

## Run locally

```bash
cd app && bun install
bun run build                                   # static export → out/
bunx wrangler d1 migrations apply ai-energy-tool --local
bunx wrangler dev --port 8971                   # http://localhost:8971, no password or sign-in: DEV_USER in .dev.vars
```

`.dev.vars` sets `DEV_USER=First Last <email>`, which opens the gate and signs every request in as that user, so
the editor loads straight away. Remove the line to test the real flow: `EMAIL_PROVIDER=console` then shows the
magic link inline on the sign-in page instead of emailing it, and the password is `WORKSPACE_PASSWORD`.

For fast UI iteration run `bun run dev -p 3010` alongside wrangler; `.env.development` points the page at
`localhost:8971` for the API and WebSocket (CORS is allowed for `DEV_ORIGIN` in `.dev.vars`). For the chat
plugin also run `cd ../chat && bun server.ts` (port 8972).

## Deploy

```bash
export CLOUDFLARE_API_TOKEN=$(security find-generic-password -a "$USER" -s cf-task-full-stack-project -w)  # or mint one with cf-custom-grant
bun run build && bunx wrangler deploy
bunx wrangler d1 migrations apply ai-energy-tool --remote   # only when migrations/ changed
```

## Using it

- Left toolbar is screen-fixed. Add square, add connected child, delete, zoom in/out, fit, load example tree, new canvas.
- New canvas starts with one required root square, "Enter the top level question", red until filled. Root cannot be deleted.
- Click inside a square to type. Drag by the grip bar. Resize by the corner handles when selected.
- Drag from a square's bottom handle to another's top to draw an arrow. Click an arrow to label it (Yes / No).
- Links in a square become pills: hover for the URL, click to open, copy icon, ⋯ menu with Share / Open / Remove.
- Top-center shows **Tree: name**. Click it to switch trees or start a **New tree**. Each tree has its own URL
  (`/?tree=<id>`, the example tree is `/`), its own history, and saves every change as you type.
- Top-right: the **PDF** button (see below), who is online, and sign out.
- **Live editing.** Other people's cursors show with their name. When someone is typing in a square it grays
  out for everyone else with "Name is editing this as of 6:15 PM". The lock lifts when they leave the field,
  close the tab, or after 5 minutes without typing.
- Right panel: list icon top right. Drag its left edge to resize, expand to full width, or pop out into its own
  window. Filter, edit, copy, add child, delete, copy the whole tree as text, and add squares via the text area.

| Key | Action |
|---|---|
| `S` | new square |
| `Tab` | new connected child below (focus moves to it) |
| `Esc` | leave the text field |
| `Delete` / `Backspace` | delete selected square or arrow |

## Source PDF

Each tree can carry one PDF, stored in R2. The **PDF** button at the top right opens it as a panel on the canvas,
three pages tall; scroll inside it with the mouse wheel or use the page arrows in its header, and drag it by
the header. If the tree has no PDF the button reads **add PDF** and uploads one (`PUT /api/tree/<id>/pdf`).

Squares can point at places in the PDF: `TreeNode.sources` is a list of `{ page, x, y, w, h }` rectangles in PDF
points, measured from the top-left of the page. With the PDF open every rectangle is highlighted in yellow and
underlined, an orange line runs from the square to it, and the line carries a **source N** label numbered in
tree order. Click a label or a highlight to jump: the canvas pans to the PDF, the PDF scrolls to the spot, and the
highlight pulses. Hover a highlight or a label and the square it came from grows and glows.

The tree `civic-signal` was built from `../context/team-docs/civic-signal-sources.pdf`, which is the team's
Numbers decision tree (its two non-blank pages) followed by the five-page project doc. Its squares and sources
are generated by `src/lib/seed-civic-signal.ts`; recreate it anywhere with
`POST /api/trees {"id":"civic-signal","name":"…","seed":"civic-signal"}` and upload the PDF.

Hover state (which square is lit) is read inside `SquareNode` and `SourceEdge` straight from the store, never
passed through the node list: rebuilding the node objects on hover makes React Flow drop and remount every
edge for a frame, which swallows the click on a source label.

To set up a fresh account: `bunx wrangler r2 bucket create ai-energy-tool-files` and apply the migrations.

## Version history

Open the right panel and switch to **history**. Every version lists time, label, author, and square/arrow counts,
with a **restore** button. Restoring saves a "before restore" checkpoint first, so nothing is ever lost.

- Automatic snapshots are taken while the tree changes, at most once a minute, and skipped when nothing changed.
  Nothing is ever pruned.
- "Save checkpoint" stores a named version on request.
- "New empty canvas" and "Load example tree" save a checkpoint before they replace the tree.
- Versions live in the same Durable Object SQLite as the tree (`versions` table).

API, with a session cookie: `GET /api/trees`, `POST /api/trees {name, seed?, id?}`, `GET /api/tree/<id>/versions`,
`GET /api/tree/<id>/versions/:n`, `POST /api/tree/<id>/versions {label}`, `POST /api/tree/<id>/versions/:n/restore`,
`GET|PUT /api/tree/<id>/pdf`.

## Backend access

`GET /api/tree/<id>/export` (with a session cookie) returns the current tree as JSON:
`{ tree, nodes[], edges[] }`, the same shapes as `src/types/tree.ts`. Only squares, arrows, and source
rectangles carry meaning; links, roles, and numbering are derived. The chat plugin walks `main`.

## Not built yet

Editing a square's source rectangles in the UI, a service token for the chat backend to call the export
without a browser session.
