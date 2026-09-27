/**
 * The editor's tree document (app/src/types/tree.ts), used exactly as the backend.
 * Squares and arrows are the only data. Meaning is derived, never stored, the same way the editor does it:
 *   - a square with arrows out is a step: the helper says its text, then waits for the resident
 *   - a square with no arrows out is an answer: the helper says its text and the chat ends
 *   - an arrow label is an option the resident's reply is matched against ("Yes", "No", "Dominion")
 *   - arrows labeled "Either" (any case) or with no label ride along with whichever option is picked;
 *     an unlabeled arrow whose siblings are labeled is the fallback when nothing matches
 *   - a square with empty text is a HOLE: the helper gives the 2-1-1 fallback instead
 * Source: data/tree.json (export of the live editor) or data/tree.seed.json (the seed) if absent.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";

export interface TreeNode { id: string; text: string; x: number; y: number; width: number; height: number; isRoot: boolean; }
export interface TreeEdge { id: string; source: string; target: string; label?: string; }
export interface TreeDocument { version: 1; tree: { id: string; name: string; rootNodeId: string; updatedAt: string }; nodes: TreeNode[]; edges: TreeEdge[]; }

export const LIVE_PATH = resolve(import.meta.dir, "../data/tree.json");
export const SEED_PATH = resolve(import.meta.dir, "../data/tree.seed.json");
export const HOLE_REPLY = "I don't have a checked answer for this part yet. Call 2-1-1 (24/7) or visit 211virginia.org and a person there can find the right local help.";
export const DECLINE_REPLY = "I can only help with one thing: electric bills for Dominion Energy customers in Fairfax County. For anything else, call 2-1-1 (24/7) or visit 211virginia.org.";

/* ---------- the editor's Worker as the source (local: wrangler dev on WORKER_ORIGIN) ---------- */

/** SESSION_SECRET from the environment, else from app/.dev.vars so local dev needs no copying. */
function sessionSecret(): string | null {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  try {
    const m = readFileSync(resolve(import.meta.dir, "../../app/.dev.vars"), "utf8").match(/^SESSION_SECRET=(.+)$/m);
    return m ? m[1].trim().replace(/^"|"$/g, "") : null;
  } catch { return null; }
}
export const workerOrigin = () => process.env.WORKER_ORIGIN || null;
export const workerEnabled = () => !!workerOrigin() && !!sessionSecret() && !process.env.TREE_JSON;

const b64u = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function serviceCookie(): string {
  const secret = sessionSecret()!;
  const sign = (p: object) => { const body = b64u(Buffer.from(JSON.stringify(p))); return `${body}.${b64u(createHmac("sha256", secret).update(body).digest())}`; };
  const exp = Math.floor(Date.now() / 1000) + 300;
  return `aet_session=${sign({ id: "chat-server", firstName: "Chat", lastName: "Server", email: "chat@local", color: "#525252", exp })}`;
}

let workerCache: { doc: TreeDocument; at: number } | null = null;
/** The live tree from the Worker's export route, cached for two seconds. Throws if the Worker is down. */
export async function fetchWorkerTree(treeId = process.env.TREE_ID ?? "main"): Promise<TreeDocument> {
  if (workerCache && Date.now() - workerCache.at < 2000) return workerCache.doc;
  const res = await fetch(`${workerOrigin()}/api/tree/${treeId}/export`, { headers: { cookie: serviceCookie() } });
  if (!res.ok) throw new Error(`Worker ${res.status} on export`);
  const doc = (await res.json()) as TreeDocument;
  workerCache = { doc, at: Date.now() };
  return doc;
}

/** Where an imported tree is written: the TREE_JSON override if set, else the live file. */
export const activePath = () => (process.env.TREE_JSON ? resolve(process.env.TREE_JSON) : LIVE_PATH);

export function loadTree(): { doc: TreeDocument; source: "live" | "seed"; path: string } {
  const p = process.env.TREE_JSON ? resolve(process.env.TREE_JSON) : existsSync(LIVE_PATH) ? LIVE_PATH : SEED_PATH;
  return { doc: JSON.parse(readFileSync(p, "utf8")), source: p === SEED_PATH ? "seed" : "live", path: p };
}

export const isHole = (n: TreeNode) => !n.text.trim();
export const isEither = (e: TreeEdge) => !!e.label && /^(either|any|all|always)$/i.test(e.label.trim());

/** Problems that make a document unusable (throw) or suspicious (warn). */
export function validate(doc: unknown): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  const d = doc as Partial<TreeDocument>;
  if (!d || typeof d !== "object" || !Array.isArray(d.nodes) || !Array.isArray(d.edges) || !d.tree) { errors.push("not a tree document: needs tree, nodes[], edges[]"); return { errors, warnings }; }
  const ids = new Set<string>();
  for (const n of d.nodes) { if (!n?.id || typeof n.text !== "string") { errors.push("square without id or text: " + JSON.stringify(n).slice(0, 80)); continue; } if (ids.has(n.id)) errors.push("duplicate square id " + n.id); ids.add(n.id); }
  const rootId = d.tree.rootNodeId || d.nodes.find((n) => n.isRoot)?.id;
  if (!rootId || !ids.has(rootId)) errors.push("no root square");
  for (const e of d.edges) { if (!ids.has(e.source) || !ids.has(e.target)) warnings.push(`arrow ${e.id} points at a missing square; ignored`); if (e.source === e.target) warnings.push(`arrow ${e.id} loops onto its own square; ignored`); }
  for (const n of d.nodes) if (!n.text?.trim()) warnings.push(`square ${n.id} is empty (hole)`);
  return { errors, warnings };
}

export class Tree {
  nodes = new Map<string, TreeNode>();
  out = new Map<string, TreeEdge[]>();
  constructor(public doc: TreeDocument) {
    const v = validate(doc);
    if (v.errors.length) throw new Error("bad tree: " + v.errors.join("; "));
    for (const n of doc.nodes) this.nodes.set(n.id, n);
    for (const e of doc.edges) { if (!this.nodes.has(e.source) || !this.nodes.has(e.target) || e.source === e.target) continue; if (!this.out.has(e.source)) this.out.set(e.source, []); this.out.get(e.source)!.push(e); }
  }
  get root(): TreeNode { return this.nodes.get(this.doc.tree.rootNodeId) ?? this.doc.nodes.find((n) => n.isRoot)!; }
  node(id: string) { return this.nodes.get(id); }
  children(id: string) { return this.out.get(id) ?? []; }
  isLeaf(id: string) { return this.children(id).length === 0; }
  /** Distinct option labels on a node's arrows, excluding ride-along ("Either") and unlabeled arrows. */
  options(id: string): { label: string; targets: TreeNode[] }[] {
    const byLabel = new Map<string, TreeNode[]>();
    for (const e of this.children(id)) {
      if (!e.label?.trim() || isEither(e)) continue;
      const k = e.label.trim();
      if (!byLabel.has(k)) byLabel.set(k, []);
      const t = this.node(e.target); if (t) byLabel.get(k)!.push(t);
    }
    return [...byLabel].map(([label, targets]) => ({ label, targets }));
  }
  /** Targets for a picked label (or null for "nothing matched"): the label's arrows plus ride-alongs; fallback arrows only when nothing matched. */
  select(id: string, label: string | null): TreeNode[] {
    const edges = this.children(id);
    const hasLabels = edges.some((e) => e.label?.trim() && !isEither(e));
    const chosen = edges.filter((e) => {
      const l = e.label?.trim() ?? "";
      if (!hasLabels) return true;                                  // plain continuation(s)
      if (isEither(e)) return true;
      if (!l) return label == null;                                 // unlabeled = fallback
      return label != null && l.toLowerCase() === label.toLowerCase();
    });
    return chosen.map((e) => this.node(e.target)!).filter(Boolean);
  }
  /** Reachability + holes, for the admin view and the coverage report. */
  report() {
    const seen = new Set<string>(); const stack = [this.root.id];
    while (stack.length) { const id = stack.pop()!; if (seen.has(id)) continue; seen.add(id); for (const e of this.children(id)) stack.push(e.target); }
    return {
      nodes: this.doc.nodes.length, edges: this.doc.edges.length,
      holes: this.doc.nodes.filter(isHole).map((n) => n.id),
      unreachable: this.doc.nodes.filter((n) => !seen.has(n.id)).map((n) => n.id),
      leaves: this.doc.nodes.filter((n) => this.isLeaf(n.id)).map((n) => n.id),
    };
  }
}
