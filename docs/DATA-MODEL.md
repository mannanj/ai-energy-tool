# Data model

Source of truth is `app/src/types/tree.ts`. Summary:

## Stored

| Type | Fields | Notes |
|---|---|---|
| `Tree` | id, name, rootNodeId, createdAt, updatedAt | One canvas. Later one tab. |
| `TreeNode` (square) | id, treeId, text, x, y, width, height, isRoot, createdAt, updatedAt, createdBy*, updatedBy* | The only shape. Exactly one `isRoot` per tree, holds the top-level question, cannot be deleted. |
| `TreeEdge` (arrow) | id, treeId, source (parent), target (child), label?, createdAt, createdBy* | Direction is parent → child. `label` is display only ("Yes", "No"). |
| `TreeDocument` | version, tree, nodes[], edges[] | The JSON shape returned by `/api/tree/:id/export`. Inside the room it is four Yjs maps: `meta`, `nodes`, `edges`, `locks`, persisted as one Yjs update blob in the Durable Object's SQLite. |

\* written later, by the multiplayer build.

## Derived at read time, never stored

| Type | How |
|---|---|
| `LinkRef` | URL regex over `TreeNode.text`; keeps character offsets so the pill can remove the link from text. |
| `DerivedNode.depth / parentIds / childIds / number` | Walk from root along edges. Children ordered left→right by canvas x. Unreachable squares are numbered `?1`, `?2`. |
| `DerivedNode.role` | root or text ending in `?` → question; has links and not a question → source; else answer. Heuristic, for display and filtering only. |
| Counts on canvas | squares = nodes.length, arrows = edges.length, text labels = edges with a label. |

The backend computes the tree from squares + arrows only. Labels, colors, sizes and positions are presentation.

## Multiplayer

`User` rows live in D1 (`app/migrations/0001_init.sql`). `NodeLock` lives in the `locks` Yjs map, refreshed on keystrokes, treated as expired 5 minutes after `lastActivityAt`, removed on blur, tab close, or when the holder drops out of awareness. `Presence` is Yjs awareness, never stored. `Workspace` is not a table yet: one password (a Worker secret) and one tree (`main`).
