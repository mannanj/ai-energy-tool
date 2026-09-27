# Real-Time Multiplayer Layer for Next.js + React Flow on Cloudflare Workers

**Date:** 2026-09-26 | **Scope:** Multi-user tree editor (React Flow) on existing paid Cloudflare account — no new subscriptions.

---

## 1. PartyKit (legacy)

**Acquired** by Cloudflare Apr 2024 ([blog](https://blog.cloudflare.com/cloudflare-acquires-partykit/)). All new projects directed to `partyserver`.

**Cloud-prem mode** (deploy to your own CF account): set `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN`, run `npx partykit deploy --domain your.domain.com`. Runs on your infra, no platform fee. But as a **separate project**, not a library.

**Maintenance:** Repo moved to `github.com/cloudflare/partykit`. Issue [#953](https://github.com/partykit/partykit/issues/953) (closed Apr 2026): *"move away from partykit and use partyserver directly."* Cloud-prem docs last updated Mar 2025. **Do not start a new project on legacy PartyKit.**

---

## 2. partyserver + y-partyserver (Recommended ✅)

Cloudflare-maintained npm packages that extend Durable Objects from within your own Worker. No separate deployment, no new subscription.

### Packages & versions (2026-09-26)

| Package | Version | Updated | Purpose |
|---------|---------|---------|---------|
| `partyserver` | 0.5.10 | 2026-08-03 | DO base class, room routing, hibernation, lifecycle hooks |
| `y-partyserver` | 2.2.0 | 2026-04-24 | Yjs CRDT backend (`withYjs` mixin, `YServer` re-export) |
| `partysocket` | 1.3.0 | 2026-06-23 | WebSocket client |
| `yjs` | 13.6.33 | 2026-09-23 | CRDT data structures |
| `@xyflow/react` | 12.11.6 | 2026-09-01 | React Flow v12 |

**Sources:** [partyserver](https://www.npmjs.com/package/partyserver), [y-partyserver](https://www.npmjs.com/package/y-partyserver), [yjs](https://www.npmjs.com/package/yjs), [@xyflow/react](https://www.npmjs.com/package/@xyflow/react).

### How it works

`partyserver` exports a `Server` class extending `DurableObject` with room routing (`routePartykitRequest(request, env)`), lifecycle hooks (`onConnect`, `onMessage`, `onClose`, `onError`, `onRequest`), broadcasting, and hibernation (`static options = { hibernate: true }`).

`y-partyserver` provides `withYjs(Server)` mixin (refactored Feb 2026, [commit 37ca0cd](https://github.com/cloudflare/partykit/commit/37ca0cde8c8e6e43cf2dea6e2dab4b39c0532bec)). Gives you `this.document`, `onLoad()`, `onSave()`, and automatic Yjs sync protocol (sync step 1/2, updates, awareness).

**Critical hibernation fix:** PR [#341](https://github.com/cloudflare/partykit/pull/341) (merged, in y-partyserver >=2.2.0) fixed awareness heartbeat preventing DO hibernation. Awareness heartbeats are now suppressed; connection state survives hibernation via `connection.setState()`. **Hibernation works correctly today.**

### Pricing & plan requirements

DOs available on **Free and Paid**. Your existing Workers Paid plan covers everything — no new billing needed.

| Resource | Free plan | Paid plan (yours) |
|----------|-----------|-------------------|
| DO requests | 100K/day | 1M/month + $0.15/M |
| DO duration | 13K GB-s/day | 400K GB-s/month + $12.50/M |
| SQLite row reads | 5M/day | 25B/month + $0.001/M |
| SQLite row writes | 100K/day | 50M/month + $1.00/M |
| SQLite storage | 5 GB total | 5 GB-month + $0.20/GB-month |
| Max DO classes | 100 | 500 |

Storage billing effective Jan 7, 2026 ([changelog](https://developers.cloudflare.com/changelog/post/2025-12-12-durable-objects-sqlite-storage-billing/)). **Source:** [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

### Persistence: DO SQLite (recommended) vs D1

**Option A — DO SQLite (simpler):**
```ts
async onLoad() {
  const row = this.ctx.storage.sql.exec(
    "SELECT data FROM tree_docs WHERE id = ?", this.name
  ).one();
  if (row) Y.applyUpdate(this.document, row.data);
}
async onSave() {
  const data = Y.encodeStateAsUpdate(this.document);
  this.ctx.storage.sql.exec(
    "INSERT OR REPLACE INTO tree_docs (id, data, updated_at) VALUES (?, ?, datetime('now'))",
    this.name, data
  );
}
```

**Option B — D1 via service binding:** For cross-room queries (list/search). More complex.

### Presence & cursors

Yjs Awareness protocol via `y-partyserver/provider`:
```ts
const awareness = new Awareness(yDoc);
awareness.setLocalStateField("cursor", { x, y });
awareness.setLocalStateField("user", { name, color });

const provider = new YProvider(host, roomId, yDoc, { awareness, party: "room", prefix: "/parties" });
```
Awareness is ephemeral (never persisted). React hook: `useYProvider` from `y-partyserver/react`.

### WebSocket architecture

#### Path A: @opennextjs/cloudflare — wrapper Worker required

Next.js API routes compiled by OpenNext **cannot** return HTTP 101 WebSocket upgrades. Issue [#784](https://github.com/opennextjs/opennextjs-cloudflare/issues/784) still open.

**Pattern** ([Answer Overflow](https://www.answeroverflow.com/m/1468254284666896416), Feb 2026):
```ts
import handler from "../.open-next/worker.js";
import { routePartykitRequest, Server } from "partyserver";

export class Room extends Server {
  static options = { hibernate: true };
  onMessage(connection, message) { this.broadcast(message, [connection.id]); }
}

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname.startsWith("/parties/"))
      return (await routePartykitRequest(request, env)) || new Response("Not Found", {status: 404});
    return handler.fetch(request, env, ctx);
  }
};
```
DO lives in **same Worker** (separate Worker with service binding only needed for >~1000 concurrent rooms).

**Wrangler:**
```jsonc
{
  "name": "my-app", "main": "src/worker.ts",
  "compatibility_date": "2026-09-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "durable_objects": { "bindings": [{ "name": "ROOM", "class_name": "Room" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Room"] }]
}
```

#### Path B: vinext (recommended for new projects)

Cloudflare now **recommends vinext** for Next.js on Workers ([docs](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/), updated Aug 2026). A Vite plugin reimplementing the Next.js API surface.

- Runs entirely in **workerd** in both dev and prod.
- DO bindings via `import { env } from "cloudflare:workers"` — no wrapper needed.
- WebSocket upgrades work natively.
- Official example: [vinext-agents-example](https://github.com/cloudflare/vinext-agents-example) shows DO agents + Next.js in one Worker.
- Beta, but rapidly maturing. Run compatibility check first.

**Decision:**

| Factor | OpenNext | vinext |
|--------|----------|--------|
| WebSocket upgrades | Wrapper Worker required | Native |
| DO bindings | `getCloudflareContext()` workaround | `cloudflare:workers` import |
| Maturity | Stable | Beta |
| Recommendation | Keep if already using | **Use for new projects** |

---

## 3. Plain Durable Objects + WebSocket Hibernation API

Hand-roll Yjs sync protocol (SyncStep1/2, updates, awareness) + persistence against DO WebSocket Hibernation API.

**Pros:** Zero deps beyond `yjs` + `y-protocols`, full control, no vendor lock-in.  
**Cons:** Non-trivial Yjs sync protocol, edge cases (missed updates, reconnection, GC), months of work. [crdt-rooms](https://github.com/giteshsarvaiya/crdt-rooms) is a 250-line reimplementation of what `y-partyserver` provides.

**Verdict:** Only if `y-partyserver` cannot meet exotic sync requirements. Otherwise saves months.

---

## 4. Cloudflare Realtime / newer products

**RealtimeKit** (announced Apr 2025, [blog](https://blog.cloudflare.com/introducing-cloudflare-realtime-and-realtimekit/)) — audio/video WebRTC suite (SFU, STUN/TURN). **Not for CRDT data sync.** DataChannels exist but are for game/chat state, not Yjs. RealtimeKit SDK ~2.0.x, still maturing ([status](https://www.cloudflarestatus.com/incidents/kv7g91gcddsn)).

**Other products:** D1 (persistence only), KV (eventually consistent — unsuitable for CRDT), Queues (async), Hyperdrive (DB pooling), R2 (object storage). **No current CF product** fills the CRDT data-sync niche that `partyserver` now occupies.

---

## 5. Yjs + React Flow integration pattern

### Data model
```ts
const yNodes = yDoc.getMap("nodes");  // Map<nodeId, Node>
const yEdges = yDoc.getMap("edges");  // Map<edgeId, Edge>
```
Key-value maps avoid array-index conflicts.

**Transient fields** (local only): `dragging`, `resizing`, `selected`, `measured`. ([React Flow multiplayer docs](https://reactflow.dev/learn/advanced-use/multiplayer))

### Sync wiring
```ts
const sync = () => {
  setNodes(Array.from(yNodes.values()) as Node[]);
  setEdges(Array.from(yEdges.values()) as Edge[]);
};
yDoc.on("sync", sync); yNodes.observe(sync); yEdges.observe(sync);

// React Flow -> Yjs
const handleNodesChange = (changes: NodeChange[]) => {
  for (const ch of changes)
    if (ch.type === "add") yNodes.set(ch.item.id, ch.item);
    else if (ch.type === "remove") yNodes.delete(ch.id);
    else if (ch.type === "replace") yNodes.set(ch.item.id, ch.item);
};
```

### Example repos
| Repo | Stack | Link |
|------|-------|------|
| React Flow Pro (collaborative) | `@xyflow/react`, yjs, y-websocket | [Example](https://reactflow.dev/examples/interaction/collaborative) (Pro) |
| crdt-rooms | CF DO, Yjs, SQLite, JWT | [GitHub](https://github.com/giteshsarvaiya/crdt-rooms) |
| flowpocus | Next.js 16, Hono, SQLite, Yjs | [GitHub](https://github.com/SweetRetry/flowpocus) |
| FlowSync | React 19, NestJS 11, Yjs 13, WS | [GitHub](https://github.com/xun082/FlowSync) |
| collabcanvas | Next.js 16, Yjs, React Flow | [GitHub](https://github.com/aminulidev/collabcanvas) |
| reactflow-yjs-integration | React Flow, Yjs, y-websocket | [GitHub](https://github.com/synergycodes/reactflow-yjs-integration) |
| Velt CRDT + React Flow | Commercial | [Docs](https://velt.mintlify.app/realtime-collaboration/crdt/setup/reactflow) |
| vinext-agents-example | vinext, Agents SDK, DO | [GitHub](https://github.com/cloudflare/vinext-agents-example) |

---

## 6. Concrete code sketch

### Server: `parties/room.ts`
```ts
import { withYjs } from "y-partyserver";
import { Server } from "partyserver";
import * as Y from "yjs";

const YjsRoom = withYjs(Server);
export class Room extends YjsRoom {
  static options = { hibernate: true };

  async onLoad() {
    const row = this.ctx.storage.sql.exec("SELECT data FROM tree_docs WHERE id = ?", this.name).one();
    if (row) Y.applyUpdate(this.document, row.data as Uint8Array);
  }

  async onSave() {
    const data = Y.encodeStateAsUpdate(this.document) satisfies Uint8Array;
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO tree_docs (id, data, updated_at) VALUES (?, ?, datetime('now'))",
      this.name, data
    );
  }
}
```

### Client: `components/TreeEditor.tsx`
```tsx
"use client";
import { useCallback, useEffect, useRef } from "react";
import { ReactFlow, useNodesState, useEdgesState, NodeChange, EdgeChange } from "@xyflow/react";
import * as Y from "yjs";
import YProvider from "y-partyserver/provider";
import { Awareness } from "y-protocols/awareness";
import "@xyflow/react/dist/style.css";

export function TreeEditor({ roomId, userId, userName, userColor }: {
  roomId: string; userId: string; userName: string; userColor: string;
}) {
  const yNodesRef = useRef<Y.Map<any>>();
  const yEdgesRef = useRef<Y.Map<any>>();
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);

  useEffect(() => {
    const yDoc = new Y.Doc();
    const awareness = new Awareness(yDoc);
    awareness.setLocalStateField("user", { id: userId, name: userName, color: userColor });

    const provider = new YProvider(window.location.origin, roomId, yDoc, {
      awareness, party: "room", prefix: "/parties",
    });

    const yNodes = yDoc.getMap("nodes");
    const yEdges = yDoc.getMap("edges");
    yNodesRef.current = yNodes;
    yEdgesRef.current = yEdges;

    const sync = () => {
      setNodes(Array.from(yNodes.values()) as any);
      setEdges(Array.from(yEdges.values()) as any);
    };
    yDoc.on("sync", sync); yNodes.observe(sync); yEdges.observe(sync);

    const onPointerMove = (e: PointerEvent) =>
      awareness.setLocalStateField("cursor", { x: e.clientX, y: e.clientY });
    document.addEventListener("pointermove", onPointerMove);

    return () => { document.removeEventListener("pointermove", onPointerMove); provider.destroy(); yDoc.destroy(); };
  }, [roomId, userId, userName, userColor, setNodes, setEdges]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    for (const ch of changes)
      if (ch.type === "add") yNodesRef.current?.set(ch.item.id, ch.item);
      else if (ch.type === "remove") yNodesRef.current?.delete(ch.id);
      else if (ch.type === "replace") yNodesRef.current?.set(ch.item.id, ch.item);
  }, []);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const ch of changes)
      if (ch.type === "add") yEdgesRef.current?.set(ch.item.id, ch.item);
      else if (ch.type === "remove") yEdgesRef.current?.delete(ch.id);
      else if (ch.type === "replace") yEdgesRef.current?.set(ch.item.id, ch.item);
  }, []);

  return <ReactFlow nodes={nodes} edges={edges} onNodesChange={handleNodesChange} onEdgesChange={handleEdgesChange} fitView />;
}
```

### Wrangler config — OpenNext path
```jsonc
{   "name": "my-app", "main": "src/worker.ts",
  "compatibility_date": "2026-09-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "durable_objects": { "bindings": [{ "name": "ROOM", "class_name": "Room" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Room"] }]
}
```

### Wrangler config — vinext path (no wrapper)
```jsonc
{   "name": "my-app",
  "compatibility_date": "2026-09-01",
  "compatibility_flags": ["nodejs_compat"],
  "durable_objects": { "bindings": [{ "name": "ROOM", "class_name": "Room" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Room"] }]
}
```
DO classes go in `worker/` dir, auto-imported by vinext.

---

## 7. Recommendation

**Use `partyserver` + `y-partyserver`.** This is the officially maintained, Cloudflare-owned evolution of PartyKit. It runs as a library inside your own Worker (no separate deployment, no new subscription), uses DOs with SQLite storage and WebSocket Hibernation (zero idle cost, hibernation now fixed via PR #341), provides built-in Yjs CRDT sync + awareness for cursors, and has clean `onLoad`/`onSave` hooks for persistence.

**Deployment choice:** For a **new project**, use **vinext** — Cloudflare's recommended Next.js-on-Workers tool. WebSocket upgrades work natively, DO bindings via `cloudflare:workers`, and the official [vinext-agents-example](https://github.com/cloudflare/vinext-agents-example) shows the exact pattern. If already on **OpenNext**, add a ~15-line wrapper Worker (pattern confirmed working by multiple community members). Skip legacy PartyKit. Hand-rolling raw DO + Yjs only for exotic sync requirements. Cloudflare Realtime is audio/video only.

**Effort estimate:** 2–4 weeks with `partyserver` + `y-partyserver` + `@xyflow/react` v12. 6–12 weeks hand-rolling.

---

## Sources

- [PartyKit cloud-prem docs](https://docs.partykit.io/guides/deploy-to-cloudflare/)
- [Cloudflare acquires PartyKit](https://blog.cloudflare.com/cloudflare-acquires-partykit/)
- [Issue #953 — partyserver migration guidance](https://github.com/partykit/partykit/issues/953)
- [Issue #234 — enterprise → partyserver](https://github.com/cloudflare/partykit/issues/234)
- [partyserver npm](https://www.npmjs.com/package/partyserver) | [y-partyserver npm](https://www.npmjs.com/package/y-partyserver) | [yjs npm](https://www.npmjs.com/package/yjs) | [@xyflow/react npm](https://www.npmjs.com/package/@xyflow/react)
- [partyserver README](https://github.com/cloudflare/partykit/blob/main/packages/partyserver/README.md)
- [y-partyserver README](https://github.com/cloudflare/partykit/blob/main/packages/y-partyserver/README.md)
- [cloudflare/partykit](https://github.com/cloudflare/partykit)
- [withYjs mixin refactor commit](https://github.com/cloudflare/partykit/commit/37ca0cde8c8e6e43cf2dea6e2dab4b39c0532bec)
- [PR #341 — hibernation & awareness fix](https://github.com/cloudflare/partykit/pull/341)
- [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) | [DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [DO SQLite billing changelog](https://developers.cloudflare.com/changelog/post/2025-12-12-durable-objects-sqlite-storage-billing/)
- [DO WebSocket Hibernation API](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/)
- [DO WebSocket server example](https://developers.cloudflare.com/durable-objects/examples/websocket-server/)
- [DO WebSocket best practices](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Cloudflare Realtime announcement](https://blog.cloudflare.com/introducing-cloudflare-realtime-and-realtimekit/)
- [Cloudflare Realtime docs](https://developers.cloudflare.com/realtime/realtimekit/)
- [OpenNext custom worker howto](https://opennext.js.org/cloudflare/howtos/custom-worker)
- [OpenNext WebSocket issue #784](https://github.com/opennextjs/opennextjs-cloudflare/issues/784)
- [OpenNext #784 workaround comment](https://github.com/opennextjs/opennextjs-cloudflare/issues/784#issuecomment-2607896503)
- [Answer Overflow: PartyServer + OpenNext](https://www.answeroverflow.com/m/1468254284666896416)
- [CF docs: Next.js on Workers (vinext)](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [vinext official site](https://vinext.dev/)
- [CF blog: vinext announcement](https://blog.cloudflare.com/vinext/)
- [cloudflare/vinext](https://github.com/cloudflare/vinext/)
- [vinext-agents-example](https://github.com/cloudflare/vinext-agents-example)
- [React Flow multiplayer guide](https://reactflow.dev/learn/advanced-use/multiplayer)
- [React Flow collaborative example](https://reactflow.dev/examples/interaction/collaborative)
- [Synergycodes: React Flow + Yjs](https://www.synergycodes.com/webbook/real-time-collaboration-for-multiple-users-in-react-flow-projects-with-yjs)
- [crdt-rooms](https://github.com/giteshsarvaiya/crdt-rooms) | [flowpocus](https://github.com/SweetRetry/flowpocus) | [FlowSync](https://github.com/xun082/FlowSync) | [collabcanvas](https://github.com/aminulidev/collabcanvas) | [reactflow-yjs-integration](https://github.com/synergycodes/reactflow-yjs-integration)
- [Velt CRDT + React Flow](https://velt.mintlify.app/realtime-collaboration/crdt/setup/reactflow)
