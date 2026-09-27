import { hasHost, host } from "./host";

export interface TreeNode { id: string; text: string; x: number; y: number; width: number; height: number; isRoot: boolean; }
export interface TreeEdge { id: string; source: string; target: string; label?: string; }
export interface TreeDocument { version: 1; tree: { id: string; name: string; rootNodeId: string; updatedAt: string }; nodes: TreeNode[]; edges: TreeEdge[]; }

export const livePath = () => host().resolve(host().dir, "../data/tree.json");
export const seedPath = () => host().resolve(host().dir, "../data/tree.seed.json");
export const HOLE_REPLY = "I don't have a checked answer for this part yet. Call 2-1-1 (24/7) or visit 211virginia.org and a person there can find the right local help.";
export const DECLINE_REPLY = "I can only help with one thing: electric bills for Dominion Energy customers in Fairfax County. For anything else, call 2-1-1 (24/7) or visit 211virginia.org.";

let customSource: (() => Promise<TreeDocument>) | null = null;
export function setTreeSource(fn: (() => Promise<TreeDocument>) | null): void { customSource = fn; workerCache = null; }

function sessionSecret(): string | null {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const m = (hasHost() ? host().readFile(host().resolve(host().dir, "../../app/.dev.vars")) : null)?.match(/^SESSION_SECRET=(.+)$/m);
  return m ? m[1].trim().replace(/^"|"$/g, "") : null;
}
export const workerOrigin = () => process.env.WORKER_ORIGIN || null;
export const workerEnabled = () => !!customSource || (!!workerOrigin() && !!sessionSecret() && !process.env.TREE_JSON);

const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function serviceCookie(): Promise<string> {
  const secret = sessionSecret()!;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const exp = Math.floor(Date.now() / 1000) + 300;
  const body = b64u(new TextEncoder().encode(JSON.stringify({ id: "chat-server", firstName: "Chat", lastName: "Server", email: "chat@local", color: "#525252", exp })));
  const sig = b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))));
  return `aet_session=${body}.${sig}`;
}

let workerCache: { doc: TreeDocument; at: number } | null = null;
export async function fetchWorkerTree(treeId = process.env.TREE_ID ?? "main"): Promise<TreeDocument> {
  if (workerCache && Date.now() - workerCache.at < 2000) return workerCache.doc;
  let doc: TreeDocument;
  if (customSource) doc = await customSource();
  else {
    const res = await fetch(`${workerOrigin()}/api/tree/${treeId}/export`, { headers: { cookie: await serviceCookie() } });
    if (!res.ok) throw new Error(`Worker ${res.status} on export`);
    doc = (await res.json()) as TreeDocument;
  }
  workerCache = { doc, at: Date.now() };
  return doc;
}

export const activePath = () => (process.env.TREE_JSON ? host().resolve(process.env.TREE_JSON) : livePath());

export function loadTree(): { doc: TreeDocument; source: "live" | "seed"; path: string } {
  const h = host();
  const p = process.env.TREE_JSON ? h.resolve(process.env.TREE_JSON) : h.exists(livePath()) ? livePath() : seedPath();
  const text = h.readFile(p);
  if (text == null) throw new Error("no tree file at " + p);
  return { doc: JSON.parse(text), source: p === seedPath() ? "seed" : "live", path: p };
}

export const isHole = (n: TreeNode) => !n.text.trim();
export const isEither = (e: TreeEdge) => !!e.label && /^(either|any|all|always)$/i.test(e.label.trim());

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
  select(id: string, label: string | null): TreeNode[] {
    const edges = this.children(id);
    const hasLabels = edges.some((e) => e.label?.trim() && !isEither(e));
    const chosen = edges.filter((e) => {
      const l = e.label?.trim() ?? "";
      if (!hasLabels) return true;
      if (isEither(e)) return true;
      if (!l) return label == null;
      return label != null && l.toLowerCase() === label.toLowerCase();
    });
    return chosen.map((e) => this.node(e.target)!).filter(Boolean);
  }
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
