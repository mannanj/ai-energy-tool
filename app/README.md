# ai-energy-tool GUI (local, single user)

Visual editor for the decision tree that powers the electric-bill chat helper. Squares connected by
arrows are the tree. Text and links live inside squares.

## Run

```bash
cd app
bun install
bun run dev -p 3010
```

Open http://localhost:3010. Data saves to the browser's localStorage on every change.
Open http://localhost:3010/panel in a second window for the pop-out panel; both windows stay in sync.

## Canvas

- Left toolbar is screen-fixed. Add square, add connected child, delete, zoom in/out, fit, load example tree, new canvas.
- New canvas starts with one required root square: "Enter the top level question".
- Click inside a square to type. Drag by the grip bar at the top. Resize with the corner handles when selected.
- Drag from the blue handle at a square's bottom to another square's top to draw an arrow.
- Click an arrow to give it a text label (Yes / No). Delete or Backspace removes a selected square or arrow. Root cannot be deleted.
- Links typed or pasted in a square become pills below the text: hover for the full URL, click to open, copy icon, ⋯ menu with Share / Open / Remove.
- Top-center badge counts squares, arrows, and text labels.

## Keyboard

| Key | Action |
|---|---|
| `S` | new square near the selected square or at the origin |
| `Tab` (in a square, or with one selected) | new connected child below, focus moves to it |
| `Esc` | leave the text field |
| `Delete` / `Backspace` | delete selected square or arrow |

## Right panel

List icon at top right opens it. Drag its left edge to resize, expand icon to take the full width,
pop-out icon to open it in its own window. Filter box, per-square edit, copy, add child, delete,
and "copy tree" as indented text. The text area at the top adds a square; with "connect under selected"
checked it becomes a child of the selected square.

## Layout

- `src/types/tree.ts` data model (see `../docs/DATA-MODEL.md`)
- `src/lib/store.ts` zustand store + localStorage + cross-window sync
- `src/lib/derive.ts` tree structure and numbering from squares + arrows
- `src/lib/links.ts` link detection
- `src/components/canvas/*` React Flow canvas, toolbar, counts, labeled arrows
- `src/components/nodes/SquareNode.tsx` the square
- `src/components/panel/*` right panel
