import { host } from "./host";
import { nanoid } from "./id";

export type Role = "system" | "user" | "assistant";
export interface Message { id: number; chat_id: string; seq: number; role: Role; content: string; created_at: string; node_id: string | null; verbatim: string | null; review: string | null; drafts: string | null; trace: string | null; }
export interface Chat {
  id: string; title: string; model: string; created_at: string; updated_at: string;
  shared_at: string | null; source: string; scenario: string | null; system_prompt: string;
  status: "open" | "done"; state: string; parent_id: string | null; parent_seq: number | null; tree_updated_at: string | null; archived: number;
}

let migrated = false;
export function migrate(): void {
  if (migrated) return;
  migrated = true;
  const sql = host().sql;
  sql.run(`CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  shared_at TEXT,
  source TEXT NOT NULL DEFAULT 'web',
  scenario TEXT,
  system_prompt TEXT NOT NULL
)`);
  sql.run(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(chat_id, seq)
)`);
  sql.run("CREATE INDEX IF NOT EXISTS messages_chat ON messages(chat_id, seq)");
  for (const col of ["status TEXT NOT NULL DEFAULT 'open'", "state TEXT NOT NULL DEFAULT '{}'"]) { try { sql.run(`ALTER TABLE chats ADD COLUMN ${col}`); } catch {} }
  for (const col of ["node_id TEXT", "verbatim TEXT", "review TEXT", "drafts TEXT", "trace TEXT"]) { try { sql.run(`ALTER TABLE messages ADD COLUMN ${col}`); } catch {} }
  for (const col of ["parent_id TEXT", "parent_seq INTEGER", "tree_updated_at TEXT", "archived INTEGER NOT NULL DEFAULT 0"]) { try { sql.run(`ALTER TABLE chats ADD COLUMN ${col}`); } catch {} }
  sql.run(`CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0
)`);
}
export function sql() { migrate(); return host().sql; }

const now = () => new Date().toISOString();

export function createChat(opts: { model: string; systemPrompt: string; source?: string; scenario?: string; title?: string; parentId?: string; parentSeq?: number; treeUpdatedAt?: string }): Chat {
  const id = nanoid(12);
  const t = now();
  sql().run(`INSERT INTO chats (id, title, model, created_at, updated_at, source, scenario, system_prompt, parent_id, parent_seq, tree_updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [id, opts.title ?? "", opts.model, t, t, opts.source ?? "web", opts.scenario ?? null, opts.systemPrompt, opts.parentId ?? null, opts.parentSeq ?? null, opts.treeUpdatedAt ?? null]);
  return getChat(id)!;
}

export function getChat(id: string): Chat | null {
  return sql().get<Chat>("SELECT * FROM chats WHERE id = ?", [id]);
}

export function getMessages(chatId: string): Message[] {
  return sql().all<Message>("SELECT * FROM messages WHERE chat_id = ? ORDER BY seq", [chatId]);
}

export function addMessage(chatId: string, role: Role, content: string, nodeId: string | null = null, extra: { verbatim?: string | null; review?: unknown; drafts?: unknown; trace?: unknown } = {}): Message {
  const seq = sql().get<{ n: number }>("SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM messages WHERE chat_id = ?", [chatId])?.n ?? 1;
  const t = now();
  sql().run("INSERT INTO messages (chat_id, seq, role, content, created_at, node_id, verbatim, review, drafts, trace) VALUES (?,?,?,?,?,?,?,?,?,?)", [chatId, seq, role, content, t, nodeId, extra.verbatim ?? null, extra.review == null ? null : JSON.stringify(extra.review), extra.drafts == null ? null : JSON.stringify(extra.drafts), extra.trace == null ? null : JSON.stringify(extra.trace)]);
  const chat = getChat(chatId)!;
  const title = chat.title || (role === "user" ? content.replace(/\s+/g, " ").trim().slice(0, 80) : "");
  sql().run("UPDATE chats SET updated_at = ?, title = ? WHERE id = ?", [t, title, chatId]);
  return sql().get<Message>("SELECT * FROM messages WHERE chat_id = ? AND seq = ?", [chatId, seq])!;
}

export function getState<T = any>(chatId: string): T {
  const c = getChat(chatId);
  try { return JSON.parse(c?.state || "{}"); } catch { return {} as T; }
}
export function setState(chatId: string, state: unknown, status: "open" | "done"): void {
  sql().run("UPDATE chats SET state = ?, status = ? WHERE id = ?", [JSON.stringify(state), status, chatId]);
}

export function shareChat(id: string): Chat | null {
  const c = getChat(id);
  if (!c) return null;
  if (!c.shared_at) sql().run("UPDATE chats SET shared_at = ? WHERE id = ?", [now(), id]);
  return getChat(id);
}

export function listChats(opts: { sharedOnly?: boolean; limit?: number; includeArchived?: boolean } = {}): (Chat & { message_count: number })[] {
  const conds = [opts.sharedOnly ? "shared_at IS NOT NULL" : "", opts.includeArchived ? "" : "archived = 0"].filter(Boolean);
  const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
  return sql().all<Chat & { message_count: number }>(
    `SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id) AS message_count
     FROM chats c ${where} ORDER BY updated_at DESC LIMIT ?`, [opts.limit ?? 200]);
}

export function archiveAllBut(keep: number, opts: { except?: string[] } = {}): { archived: number; kept: string[] } {
  const keepIds = new Set([...sql().all<{ id: string }>("SELECT id FROM chats WHERE archived = 0 ORDER BY created_at DESC LIMIT ?", [keep]).map((r) => r.id), ...(opts.except ?? [])]);
  const all = sql().all<{ id: string }>("SELECT id FROM chats WHERE archived = 0");
  let n = 0;
  for (const r of all) if (!keepIds.has(r.id)) { sql().run("UPDATE chats SET archived = 1 WHERE id = ?", [r.id]); n++; }
  return { archived: n, kept: [...keepIds] };
}
export function setArchived(id: string, archived: boolean): void { sql().run("UPDATE chats SET archived = ? WHERE id = ?", [archived ? 1 : 0, id]); }

export function deleteChat(id: string): void {
  sql().run("DELETE FROM messages WHERE chat_id = ?", [id]);
  sql().run("DELETE FROM chats WHERE id = ?", [id]);
}

export function transcript(chat: Chat, messages: Message[]): string {
  const lines = [`# ${chat.title || "Chat"}`, `${chat.created_at}  model ${chat.model}${chat.scenario ? `  scenario ${chat.scenario}` : ""}`, ""];
  for (const m of messages) lines.push(`${m.role === "user" ? "Resident" : "Helper"}: ${m.content}`, "");
  return lines.join("\n");
}
