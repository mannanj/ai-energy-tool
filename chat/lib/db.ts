import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { nanoid } from "./id";

export type Role = "system" | "user" | "assistant";
export interface Message { id: number; chat_id: string; seq: number; role: Role; content: string; created_at: string; node_id: string | null; verbatim: string | null; review: string | null; drafts: string | null; }
export interface Chat {
  id: string; title: string; model: string; created_at: string; updated_at: string;
  shared_at: string | null; source: string; scenario: string | null; system_prompt: string;
  status: "open" | "done"; state: string; parent_id: string | null; parent_seq: number | null; tree_updated_at: string | null; archived: number;
}

const path = resolve(import.meta.dir, "..", process.env.DB_PATH ?? "./data/chats.sqlite");
mkdirSync(dirname(path), { recursive: true });
export const db = new Database(path, { create: true });
db.run("PRAGMA journal_mode = WAL");
db.run(`CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  shared_at TEXT,
  source TEXT NOT NULL DEFAULT 'web',      -- web | simulate
  scenario TEXT,                            -- persona name for simulated chats
  system_prompt TEXT NOT NULL               -- exact prompt used, so a chat can be replayed
)`);
db.run(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(chat_id, seq)
)`);
db.run("CREATE INDEX IF NOT EXISTS messages_chat ON messages(chat_id, seq)");
for (const col of ["status TEXT NOT NULL DEFAULT 'open'", "state TEXT NOT NULL DEFAULT '{}'"]) {
  try { db.run(`ALTER TABLE chats ADD COLUMN ${col}`); } catch { }
}
for (const col of ["node_id TEXT", "verbatim TEXT", "review TEXT", "drafts TEXT"]) { try { db.run(`ALTER TABLE messages ADD COLUMN ${col}`); } catch { } }
for (const col of ["parent_id TEXT", "parent_seq INTEGER", "tree_updated_at TEXT", "archived INTEGER NOT NULL DEFAULT 0"]) { try { db.run(`ALTER TABLE chats ADD COLUMN ${col}`); } catch { } }

const now = () => new Date().toISOString();

export function createChat(opts: { model: string; systemPrompt: string; source?: string; scenario?: string; title?: string; parentId?: string; parentSeq?: number; treeUpdatedAt?: string }): Chat {
  const id = nanoid(12);
  const t = now();
  db.query(`INSERT INTO chats (id, title, model, created_at, updated_at, source, scenario, system_prompt, parent_id, parent_seq, tree_updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, opts.title ?? "", opts.model, t, t, opts.source ?? "web", opts.scenario ?? null, opts.systemPrompt, opts.parentId ?? null, opts.parentSeq ?? null, opts.treeUpdatedAt ?? null);
  return getChat(id)!;
}

export function getChat(id: string): Chat | null {
  return db.query<Chat, [string]>("SELECT * FROM chats WHERE id = ?").get(id) ?? null;
}

export function getMessages(chatId: string): Message[] {
  return db.query<Message, [string]>("SELECT * FROM messages WHERE chat_id = ? ORDER BY seq").all(chatId);
}

export function addMessage(chatId: string, role: Role, content: string, nodeId: string | null = null, extra: { verbatim?: string | null; review?: unknown; drafts?: unknown } = {}): Message {
  const seq = (db.query<{ n: number }, [string]>("SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM messages WHERE chat_id = ?").get(chatId)?.n) ?? 1;
  const t = now();
  db.query("INSERT INTO messages (chat_id, seq, role, content, created_at, node_id, verbatim, review, drafts) VALUES (?,?,?,?,?,?,?,?,?)").run(chatId, seq, role, content, t, nodeId, extra.verbatim ?? null, extra.review == null ? null : JSON.stringify(extra.review), extra.drafts == null ? null : JSON.stringify(extra.drafts));
  const chat = getChat(chatId)!;
  const title = chat.title || (role === "user" ? content.replace(/\s+/g, " ").trim().slice(0, 80) : "");
  db.query("UPDATE chats SET updated_at = ?, title = ? WHERE id = ?").run(t, title, chatId);
  return db.query<Message, [string, number]>("SELECT * FROM messages WHERE chat_id = ? AND seq = ?").get(chatId, seq)!;
}

export function getState<T = any>(chatId: string): T {
  const c = getChat(chatId);
  try { return JSON.parse(c?.state || "{}"); } catch { return {} as T; }
}
export function setState(chatId: string, state: unknown, status: "open" | "done"): void {
  db.query("UPDATE chats SET state = ?, status = ? WHERE id = ?").run(JSON.stringify(state), status, chatId);
}

export function shareChat(id: string): Chat | null {
  const c = getChat(id);
  if (!c) return null;
  if (!c.shared_at) db.query("UPDATE chats SET shared_at = ? WHERE id = ?").run(now(), id);
  return getChat(id);
}

export function listChats(opts: { sharedOnly?: boolean; limit?: number; includeArchived?: boolean } = {}): (Chat & { message_count: number })[] {
  const conds = [opts.sharedOnly ? "shared_at IS NOT NULL" : "", opts.includeArchived ? "" : "archived = 0"].filter(Boolean);
  const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
  return db.query<Chat & { message_count: number }, [number]>(
    `SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id) AS message_count
     FROM chats c ${where} ORDER BY updated_at DESC LIMIT ?`).all(opts.limit ?? 200);
}

export function archiveAllBut(keep: number, opts: { except?: string[] } = {}): { archived: number; kept: string[] } {
  const keepIds = new Set([...db.query<{ id: string }, [number]>("SELECT id FROM chats WHERE archived = 0 ORDER BY created_at DESC LIMIT ?").all(keep).map((r) => r.id), ...(opts.except ?? [])]);
  const all = db.query<{ id: string }, []>("SELECT id FROM chats WHERE archived = 0").all();
  let n = 0;
  for (const r of all) if (!keepIds.has(r.id)) { db.query("UPDATE chats SET archived = 1 WHERE id = ?").run(r.id); n++; }
  return { archived: n, kept: [...keepIds] };
}
export function setArchived(id: string, archived: boolean): void { db.query("UPDATE chats SET archived = ? WHERE id = ?").run(archived ? 1 : 0, id); }

export function deleteChat(id: string): void {
  db.query("DELETE FROM messages WHERE chat_id = ?").run(id);
  db.query("DELETE FROM chats WHERE id = ?").run(id);
}

export function transcript(chat: Chat, messages: Message[]): string {
  const lines = [`# ${chat.title || "Chat"}`, `${chat.created_at}  model ${chat.model}${chat.scenario ? `  scenario ${chat.scenario}` : ""}`, ""];
  for (const m of messages) lines.push(`${m.role === "user" ? "Resident" : "Helper"}: ${m.content}`, "");
  return lines.join("\n");
}
