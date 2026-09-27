import { Server } from "partyserver";
import { withYjs } from "y-partyserver";
import * as Y from "yjs";
import type { TreeDocument, TreeNode, TreeEdge } from "../src/types/tree";

export class TreeRoom extends withYjs(Server) {
  static options = { hibernate: true };
  static callbackOptions = { debounceWait: 400, debounceMaxWait: 2000, timeout: 5000 };

  static AUTO_SNAPSHOT_MS = 60_000;
  static KEEP_VERSIONS = 500;

  async onLoad() {
    this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS tree_docs (id TEXT PRIMARY KEY, data BLOB NOT NULL, updated_at TEXT NOT NULL)");
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS versions (
      n INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, label TEXT NOT NULL, author TEXT NOT NULL,
      node_count INTEGER NOT NULL, edge_count INTEGER NOT NULL, hash TEXT NOT NULL, data TEXT NOT NULL)`);
    const rows = this.ctx.storage.sql.exec("SELECT data FROM tree_docs WHERE id = ?", this.name).toArray();
    if (rows.length) {
      Y.applyUpdate(this.document, new Uint8Array(rows[0].data as ArrayBuffer));
    }
    if (!this.document.getMap("meta").get("rootNodeId")) this.seed();
  }

  async onSave() {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO tree_docs (id, data, updated_at) VALUES (?, ?, datetime('now'))",
      this.name, Y.encodeStateAsUpdate(this.document),
    );
    this.snapshotIfDue();
  }

  private lastVersion(): { n: number; created_at: string; hash: string } | null {
    const r = this.ctx.storage.sql.exec("SELECT n, created_at, hash FROM versions ORDER BY n DESC LIMIT 1").toArray();
    return r.length ? (r[0] as unknown as { n: number; created_at: string; hash: string }) : null;
  }

  private contentHash(doc: TreeDocument): string {
    const strip = (o: object) => JSON.stringify(o, (k, v) => (k === "updatedAt" || k === "createdAt" || k === "updatedBy" ? undefined : v));
    const s = strip({ nodes: [...doc.nodes].sort((a, b) => a.id.localeCompare(b.id)), edges: [...doc.edges].sort((a, b) => a.id.localeCompare(b.id)), root: doc.tree.rootNodeId, name: doc.tree.name });
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h.toString(16) + ":" + s.length;
  }

  saveVersion(label: string, author: string, force = false): number | null {
    const doc = this.snapshot();
    const hash = this.contentHash(doc);
    const last = this.lastVersion();
    if (!force && last && last.hash === hash) return null;
    this.ctx.storage.sql.exec(
      "INSERT INTO versions (created_at, label, author, node_count, edge_count, hash, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
      new Date().toISOString(), label, author, doc.nodes.length, doc.edges.length, hash, JSON.stringify(doc),
    );
    const n = this.lastVersion()!.n;
    this.ctx.storage.sql.exec(
      "DELETE FROM versions WHERE label = 'auto' AND n NOT IN (SELECT n FROM versions ORDER BY n DESC LIMIT ?)", TreeRoom.KEEP_VERSIONS,
    );
    return n;
  }

  private snapshotIfDue() {
    const last = this.lastVersion();
    if (last && Date.now() - Date.parse(last.created_at) < TreeRoom.AUTO_SNAPSHOT_MS) return;
    this.saveVersion("auto", "auto");
  }

  listVersions() {
    return this.ctx.storage.sql
      .exec("SELECT n, created_at, label, author, node_count, edge_count FROM versions ORDER BY n DESC LIMIT 200")
      .toArray()
      .map((r) => ({ n: r.n as number, createdAt: r.created_at as string, label: r.label as string, author: r.author as string, nodeCount: r.node_count as number, edgeCount: r.edge_count as number }));
  }

  getVersion(n: number): TreeDocument | null {
    const r = this.ctx.storage.sql.exec("SELECT data FROM versions WHERE n = ?", n).toArray();
    return r.length ? (JSON.parse(r[0].data as string) as TreeDocument) : null;
  }

  restore(doc: TreeDocument) {
    const nodes = this.document.getMap("nodes"), edges = this.document.getMap("edges"), locks = this.document.getMap("locks"), meta = this.document.getMap("meta");
    this.document.transact(() => {
      nodes.clear(); edges.clear(); locks.clear();
      for (const n of doc.nodes) nodes.set(n.id, n);
      for (const e of doc.edges) edges.set(e.id, e);
      meta.set("rootNodeId", doc.tree.rootNodeId); meta.set("name", doc.tree.name); meta.set("updatedAt", new Date().toISOString());
    }, "restore");
  }

  private seed() {
    const t = new Date().toISOString();
    const rootId = crypto.randomUUID().slice(0, 10);
    const root: TreeNode = { id: rootId, treeId: this.name, text: "", x: 0, y: 0, width: 360, height: 120, isRoot: true, createdAt: t, updatedAt: t };
    this.document.transact(() => {
      const meta = this.document.getMap("meta");
      meta.set("id", this.name); meta.set("name", "Rates went up"); meta.set("rootNodeId", rootId);
      meta.set("createdAt", t); meta.set("updatedAt", t);
      this.document.getMap("nodes").set(rootId, root);
    });
  }

  snapshot(): TreeDocument {
    const meta = this.document.getMap("meta");
    return {
      version: 1,
      tree: { id: this.name, name: String(meta.get("name") ?? ""), rootNodeId: String(meta.get("rootNodeId") ?? ""), createdAt: String(meta.get("createdAt") ?? ""), updatedAt: String(meta.get("updatedAt") ?? "") },
      nodes: [...this.document.getMap("nodes").values()] as TreeNode[],
      edges: [...this.document.getMap("edges").values()] as TreeEdge[],
    };
  }

  async onRequest(req: Request) {
    const url = new URL(req.url);
    const author = req.headers.get("x-aet-user") ?? "unknown";
    const path = url.pathname.replace(/^\/parties\/[^/]+\/[^/]+/, "") || "/export";

    if (req.method === "GET" && path === "/export") return Response.json(this.snapshot());
    if (req.method === "GET" && path === "/versions") return Response.json({ versions: this.listVersions() });

    const one = /^\/versions\/(\d+)(\/restore)?$/.exec(path);
    if (one && req.method === "GET" && !one[2]) {
      const v = this.getVersion(Number(one[1]));
      return v ? Response.json(v) : Response.json({ error: "not found" }, { status: 404 });
    }
    if (req.method === "POST" && path === "/versions") {
      const body = (await req.json().catch(() => ({}))) as { label?: string };
      const label = (body.label ?? "").trim().slice(0, 80) || "checkpoint";
      const n = this.saveVersion(label, author, true);
      return Response.json({ ok: true, n });
    }
    if (one && one[2] && req.method === "POST") {
      const v = this.getVersion(Number(one[1]));
      if (!v) return Response.json({ error: "not found" }, { status: 404 });
      this.saveVersion(`before restore of #${one[1]}`, author, true);
      this.restore(v);
      const n = this.saveVersion(`restored #${one[1]}`, author, true);
      return Response.json({ ok: true, n });
    }
    return Response.json({ error: "not found" }, { status: 404 });
  }
}
