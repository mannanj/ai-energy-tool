import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "./db";
import { nanoid } from "./id";
import { complete } from "./llm";

export interface Prompt { id: string; title: string; text: string; created_at: string; active: number }

const MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash";
const FILE = resolve(import.meta.dir, "../../context/system-prompt.md");

db.run(`CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0
)`);

function seed(): void {
  if (db.query("SELECT 1 FROM prompts LIMIT 1").get()) return;
  let text = "";
  try { text = readFileSync(FILE, "utf8"); } catch {}
  db.query("INSERT INTO prompts (id, title, text, created_at, active) VALUES (?,?,?,?,1)").run(nanoid(10), "Original (system-prompt.md)", text, new Date().toISOString());
}
seed();

export function listPrompts(): Prompt[] {
  return db.query<Prompt, []>("SELECT * FROM prompts ORDER BY created_at DESC").all();
}
export function activePrompt(): Prompt {
  return db.query<Prompt, []>("SELECT * FROM prompts WHERE active = 1 LIMIT 1").get() ?? listPrompts()[0];
}
export function activate(id: string): Prompt | null {
  if (!db.query("SELECT 1 FROM prompts WHERE id = ?").get(id)) return null;
  db.run("UPDATE prompts SET active = 0");
  db.query("UPDATE prompts SET active = 1 WHERE id = ?").run(id);
  return activePrompt();
}
export function rename(id: string, title: string): void {
  db.query("UPDATE prompts SET title = ? WHERE id = ?").run(title.trim().slice(0, 80) || "Untitled", id);
}
export async function savePrompt(text: string, title?: string): Promise<Prompt> {
  const prev = activePrompt();
  let t = (title ?? "").trim();
  if (!t) t = await nameFor(prev?.text ?? "", text);
  const id = nanoid(10);
  db.run("UPDATE prompts SET active = 0");
  db.query("INSERT INTO prompts (id, title, text, created_at, active) VALUES (?,?,?,?,1)").run(id, t, text, new Date().toISOString());
  return activePrompt();
}

async function nameFor(before: string, after: string): Promise<string> {
  try {
    const out = await complete(MODEL, [
      { role: "system", content: "You name versions of a chatbot system prompt. Reply with only a title of 2 to 6 plain words that says what changed from BEFORE to AFTER. No quotes, no period." },
      { role: "user", content: `BEFORE:\n${before.slice(0, 6000)}\n\nAFTER:\n${after.slice(0, 6000)}` },
    ], { temperature: 0.2, maxTokens: 30 });
    const t = out.replace(/^["'\s]+|["'.\s]+$/g, "").slice(0, 80);
    if (t) return t;
  } catch {}
  return "Edited " + new Date().toLocaleString();
}
