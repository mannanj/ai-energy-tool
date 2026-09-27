import { routePartykitRequest, Server } from "partyserver";
import { withYjs } from "y-partyserver";
import * as Y from "yjs";

export class TreeRoom extends withYjs(Server) {
  static options = { hibernate: true };
  static callbackOptions = { debounceWait: 500, debounceMaxWait: 2000, timeout: 5000 };

  async onLoad() {
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS tree_docs (id TEXT PRIMARY KEY, data BLOB NOT NULL, updated_at TEXT NOT NULL)"
    );
    const rows = this.ctx.storage.sql.exec("SELECT data FROM tree_docs WHERE id = ?", this.name).toArray();
    if (rows.length) Y.applyUpdate(this.document, new Uint8Array(rows[0].data as ArrayBuffer));
  }

  async onSave() {
    const data = Y.encodeStateAsUpdate(this.document);
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO tree_docs (id, data, updated_at) VALUES (?, ?, datetime('now'))",
      this.name, data
    );
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");
    return (await routePartykitRequest(request, env as unknown as Record<string, unknown>)) ?? new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

interface Env { TreeRoom: DurableObjectNamespace }
