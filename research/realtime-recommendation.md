# Real-time multiplayer on the Cloudflare stack: recommendation

*Written 2026-09-26 after research (`realtime-viability.md`) and a live experiment (`../experiments/rt-partyserver`).*

## Verdict: yes, feasible with the current stack and constraints

Use **partyserver + y-partyserver** (Cloudflare's maintained successor to PartyKit) running as a
Durable Object inside our own Worker, with **Yjs** for conflict-free shared state and Yjs
**awareness** for live cursors and "who is editing". No new subscription, no new billing item.
Durable Objects are included in the existing Workers Paid plan.

## What was tested

Worker `aet-rt-experiment` deployed to the account (`https://aet-rt-experiment.mannanteam.workers.dev`)
with one Durable Object class `TreeRoom` (SQLite-backed, WebSocket hibernation on). Test
`test/two-clients.mjs`, run locally under `wrangler dev` and again against the live Worker:

| Check | Local | Live on Cloudflare |
|---|---|---|
| Two clients join the same room and sync | 52 ms | 357 ms |
| Client B sees a square written by A | ≤50 ms | ≤50 ms |
| Client B sees A's cursor via awareness | ≤50 ms | ≤50 ms |
| Concurrent writes from A and B converge | pass | pass |
| All leave, fresh client C loads persisted doc from DO SQLite | pass | pass |

(≤50 ms is the poll interval of the test, so real latency is at or under that.)

## Why not PartyKit itself

PartyKit was acquired by Cloudflare in 2024. Its "cloud-prem" mode can deploy to our account but it is
a separate project with docs last touched in 2025, and its own tracker says to move to partyserver.
partyserver is the same API as a library inside our Worker.

## Deployment shape for the real app

- One Worker named `ai-energy-tool`. Next.js served through OpenNext with a ~15 line wrapper that
  routes `/parties/*` to the Durable Object and everything else to Next. (Cloudflare's newer
  `vinext` path avoids the wrapper but is still beta; OpenNext is the safe choice today.)
- One Durable Object per tree, named by tree id. Later each tab is one room.
- D1 keeps users, magic-link tokens, workspace password hash, and the tree list. The tree content
  itself lives in the room's SQLite as a Yjs update blob plus a JSON mirror for the chat backend.

## Shared state layout (Yjs)

- `nodes`: Y.Map<nodeId, TreeNode> and `edges`: Y.Map<edgeId, TreeEdge>, same fields as
  `app/src/types/tree.ts`. Text stays a plain string per square. Two people typing in the same square
  is prevented by the lock below, so character-level CRDT text is not needed.
- Awareness (ephemeral, not stored): `{ user: {id, name, color}, cursor: {x, y} in canvas coords,
  editingNodeId }`.

## Editing lock, as you described it

- When a user focuses a square, the room records `NodeLock { nodeId, userId, userName, lockedAt,
  lastActivityAt }`. Every keystroke refreshes `lastActivityAt`.
- Everyone else sees that square's text area grayed out with a label above it:
  "John Smith is editing this as of 6:15 PM".
- A lock expires 5 minutes after the last activity, or immediately on blur or disconnect. The server
  owns the clock so nobody can hold a lock from a closed laptop.
- If the holder comes back after expiry and someone else now holds it, they get the same gray block
  in real time.
- Locks live in the Yjs doc (a `locks` Y.Map) so they arrive with the same sync stream. The DO
  sweeps expired locks on an alarm.

## Cost expectation

Idle rooms hibernate and cost nothing. A team of five editing for an hour is a few thousand DO
requests and well under the included 1 million per month.

## Status 2026-09-27: built and live

Everything above except tabs and files is deployed as Worker `ai-energy-tool`
(https://ai-energy-tool.mannanteam.workers.dev). The app is a Next.js static export served by a
hand-written Worker rather than OpenNext, so no wrapper is needed and the same Worker owns the gate,
magic links, and the room. Live two-browser test passed: sync, cursors, editing lock both directions,
pop-out panel, persistence across reload. See `app/README.md`.
