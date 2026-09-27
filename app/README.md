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
| Room | `worker/room.ts` | one Durable Object per tree (`TreeRoom`), Yjs document persisted to DO SQLite, seeds the root square, `GET` returns a JSON snapshot |
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
bunx wrangler dev --port 8971                   # http://localhost:8971, password "letmein" (.dev.vars)
```

`.dev.vars` sets `EMAIL_PROVIDER=console`, so the sign-in page shows the magic link inline instead of emailing it.

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
- Top-center badge counts squares, arrows, and text labels. Top-right shows who is online and sign out.
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

## Version history

Open the right panel and switch to **history**. Every version lists time, label, author, and square/arrow counts,
with a **restore** button. Restoring saves a "before restore" checkpoint first, so nothing is ever lost.

- Automatic snapshots are taken while the tree changes, at most once a minute, and skipped when nothing changed.
- "Save checkpoint" stores a named version on request.
- "New empty canvas" and "Load example tree" save a checkpoint before they replace the tree.
- Versions live in the same Durable Object SQLite as the tree (`versions` table). The newest 500 automatic
  snapshots are kept; named checkpoints are never pruned.

API, with a session cookie: `GET /api/tree/main/versions`, `GET /api/tree/main/versions/:n`,
`POST /api/tree/main/versions {label}`, `POST /api/tree/main/versions/:n/restore`.

## Backend access

`GET /api/tree/main/export` (with a session cookie) returns the current tree as JSON:
`{ tree, nodes[], edges[] }`, the same shapes as `src/types/tree.ts`. Only squares and arrows carry
meaning; links, roles, and numbering are derived.

## Not built yet

Tabs for more trees (one room per tab is the plan), file attachments, a service token for the chat backend
to call the export without a browser session.
