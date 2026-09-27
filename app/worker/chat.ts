import { DurableObject } from "cloudflare:workers";
import { getServerByName } from "partyserver";
import type { Env } from "./env";
import { setHost, type SqlDriver } from "../../chat/lib/host";
import { setTreeSource, fetchWorkerTree, type TreeDocument } from "../../chat/lib/tree";
import { migrate, sql } from "../../chat/lib/db";
import { chatApi } from "../../chat/lib/routes";
import { nanoid } from "../../chat/lib/id";
import seed from "./seed-chats.json";

const PASS = ["OPENROUTER_API_KEY", "OPENROUTER_MODEL", "TYPESAFE_API_KEY", "TYPESAFE_MODEL", "SIM_MODEL"] as const;
type Row = Record<string, string | number | null>;
interface Seed { version: number; chats: Row[]; messages: Row[]; prompts: Row[]; squares: Record<string, string> }
const norm = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();

export class ChatStore extends DurableObject<Env> {
  private seeded: Promise<void> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const store = ctx.storage.sql;
    const driver: SqlDriver = {
      all: (q, p = []) => store.exec(q, ...(p as (string | number | null)[])).toArray() as never,
      get: (q, p = []) => (store.exec(q, ...(p as (string | number | null)[])).toArray()[0] as never) ?? null,
      run: (q, p = []) => { store.exec(q, ...(p as (string | number | null)[])); },
    };
    setHost({
      sql: driver, dir: "",
      readFile: () => null,
      writeFile: () => { throw new Error("the tree is edited in the editor, not imported, in production"); },
      exists: () => false,
      mtime: () => 0,
      resolve: (...parts) => parts.join("/"),
    });
    for (const k of PASS) if (env[k]) process.env[k] = env[k];
    process.env.PUBLIC_ORIGIN = env.APP_ORIGIN;
    setTreeSource(async () => {
      const stub = await getServerByName(env.TreeRoom as unknown as Parameters<typeof getServerByName>[0], "main");
      const r = await stub.fetch(new Request("https://room/parties/tree-room/main/export"));
      if (!r.ok) throw new Error(`tree room ${r.status}`);
      return (await r.json()) as TreeDocument;
    });
    migrate();
    sql().run("CREATE TABLE IF NOT EXISTS seed_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  }

  private async seedOnce(): Promise<void> {
    const s = seed as Seed;
    const stored = sql().get<{ value: string }>("SELECT value FROM seed_meta WHERE key = 'version'")?.value;
    if (stored === String(s.version)) return;
    const tree = await fetchWorkerTree();
    const byText = new Map(tree.nodes.map((n) => [norm(n.text), n.id]));
    const remap = (id: string) => byText.get(norm(s.squares[id] ?? "")) ?? id;
    const previous: string[] = JSON.parse(sql().get<{ value: string }>("SELECT value FROM seed_meta WHERE key = 'chat_ids'")?.value ?? "[]");
    const legacy = s.chats.map((c) => c.id as string);
    for (const id of [...previous, ...legacy]) sql().run("UPDATE chats SET archived = 1 WHERE id = ?", [id]);
    const insert = (table: string, row: Row) => {
      const keys = Object.keys(row);
      sql().run(`INSERT OR IGNORE INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`, keys.map((k) => row[k]));
    };
    const newIds: Record<string, string> = {};
    for (const c of s.chats) { newIds[c.id as string] = nanoid(12); insert("chats", { ...c, id: newIds[c.id as string], archived: 0, tree_updated_at: tree.tree.updatedAt }); }
    for (const m of s.messages) {
      const nodeId = typeof m.node_id === "string" && m.node_id ? m.node_id.split(",").map(remap).join(",") : m.node_id;
      insert("messages", { ...m, chat_id: newIds[m.chat_id as string], node_id: nodeId });
    }
    for (const p of s.prompts) insert("prompts", p);
    sql().run("INSERT OR REPLACE INTO seed_meta (key, value) VALUES ('version', ?)", [String(s.version)]);
    sql().run("INSERT OR REPLACE INTO seed_meta (key, value) VALUES ('chat_ids', ?)", [JSON.stringify(Object.values(newIds))]);
  }

  async fetch(req: Request): Promise<Response> {
    try { await (this.seeded ??= this.seedOnce()); } catch (e) { this.seeded = null; console.error("seed failed:", (e as Error).message); }
    return (await chatApi(req, this.env.APP_ORIGIN)) ?? Response.json({ error: "not found" }, { status: 404 });
  }
}
