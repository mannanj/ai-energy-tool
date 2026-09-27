/**
 * One Durable Object per tree. Yjs document with maps: meta, nodes, edges, locks.
 * Persists to the DO's own SQLite. Seeds the required root square on first load.
 * GET (non-WebSocket) returns a JSON snapshot for the chat backend.
 */
import { Server } from "partyserver";
import { withYjs } from "y-partyserver";
import * as Y from "yjs";
import type { TreeDocument, TreeNode, TreeEdge } from "../src/types/tree";

export class TreeRoom extends withYjs(Server) {
  static options = { hibernate: true };
  static callbackOptions = { debounceWait: 400, debounceMaxWait: 2000, timeout: 5000 };

  async onLoad() {
    this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS tree_docs (id TEXT PRIMARY KEY, data BLOB NOT NULL, updated_at TEXT NOT NULL)");
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

  async onRequest(_req: Request) {
    return Response.json(this.snapshot());
  }
}
