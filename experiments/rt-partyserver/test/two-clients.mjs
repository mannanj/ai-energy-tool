// Two Yjs clients join the same room; A writes a node + cursor, B must see both.
// Then both leave, C joins fresh and must see A's node (persistence through onSave/onLoad).
import * as Y from "yjs";
import YProvider from "y-partyserver/provider";
import { Awareness } from "y-protocols/awareness";

const HOST = process.env.HOST ?? "localhost:8788";
const room = "exp-" + Date.now();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000, label = "") => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await wait(50); } throw new Error("timeout: " + label); };

function client(name) {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  awareness.setLocalStateField("user", { name });
  const provider = new YProvider(HOST, room, doc, { awareness, party: "tree-room" });
  return { name, doc, awareness, provider, nodes: doc.getMap("nodes") };
}

const t0 = Date.now();
const A = client("Alice"), B = client("Bob");
await until(() => A.provider.synced && B.provider.synced, 10000, "initial sync");
console.log("A+B synced in", Date.now() - t0, "ms");

// A writes a square
const tw = Date.now();
A.nodes.set("n1", { id: "n1", text: "Top level question?", x: 0, y: 0, width: 240, height: 120 });
await until(() => B.nodes.get("n1")?.text === "Top level question?", 5000, "B sees A's node");
console.log("B saw A's node in", Date.now() - tw, "ms");

// A moves cursor; B must see it in awareness
const tc = Date.now();
A.awareness.setLocalStateField("cursor", { x: 123, y: 456 });
await until(() => [...B.awareness.getStates().values()].some((s) => s.cursor?.x === 123 && s.user?.name === "Alice"), 5000, "B sees A's cursor");
console.log("B saw A's cursor in", Date.now() - tc, "ms; peers seen by B:", B.awareness.getStates().size);

// concurrent edits from both sides converge
A.nodes.set("n2", { id: "n2", text: "from A" });
B.nodes.set("n3", { id: "n3", text: "from B" });
await until(() => A.nodes.size === 3 && B.nodes.size === 3, 5000, "converge");
console.log("converged: both see 3 nodes");

// leave, let server save, then a fresh client must load persisted state
A.provider.destroy(); B.provider.destroy();
await wait(3000);
const C = client("Carol");
await until(() => C.provider.synced, 10000, "C sync");
await wait(500);
console.log("C (fresh) sees nodes:", C.nodes.size, "->", [...C.nodes.keys()].join(","));
C.provider.destroy();
console.log(C.nodes.size === 3 ? "PERSISTENCE OK" : "PERSISTENCE FAILED");
process.exit(C.nodes.size === 3 ? 0 : 1);
