import { DurableObject } from "cloudflare:workers";
import { getServerByName } from "partyserver";
import type { Env } from "./env";
import { setHost, type SqlDriver } from "../../chat/lib/host";
import { setTreeSource, type TreeDocument } from "../../chat/lib/tree";
import { migrate, sql } from "../../chat/lib/db";
import { chatApi } from "../../chat/lib/routes";
import seed from "./seed-chats.json";

const PASS = ["OPENROUTER_API_KEY", "OPENROUTER_MODEL", "TYPESAFE_API_KEY", "TYPESAFE_MODEL", "SIM_MODEL"] as const;

export class ChatStore extends DurableObject<Env> {
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
    this.seedOnce();
  }

  private seedOnce() {
    if (sql().get("SELECT 1 FROM chats LIMIT 1")) return;
    const s = seed as { chats: Record<string, unknown>[]; messages: Record<string, unknown>[]; prompts: Record<string, unknown>[] };
    const insert = (table: string, row: Record<string, unknown>) => {
      const keys = Object.keys(row);
      sql().run(`INSERT OR IGNORE INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`, keys.map((k) => row[k] as string | number | null));
    };
    for (const c of s.chats) insert("chats", c);
    for (const m of s.messages) { const { id: _id, ...rest } = m; void _id; insert("messages", rest); }
    for (const p of s.prompts) insert("prompts", p);
  }

  async fetch(req: Request): Promise<Response> {
    return (await chatApi(req, this.env.APP_ORIGIN)) ?? Response.json({ error: "not found" }, { status: 404 });
  }
}
