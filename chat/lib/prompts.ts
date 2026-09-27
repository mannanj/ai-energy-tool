import { sql } from "./db";
import { nanoid } from "./id";
import { complete } from "./llm";
import { DEFAULT_PROMPT } from "./default-prompt";

export interface Prompt { id: string; title: string; text: string; created_at: string; active: number }

const MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash";
let seeded = false;
function seed(): void {
  if (seeded) return;
  seeded = true;
  if (sql().get("SELECT 1 FROM prompts LIMIT 1")) return;
  sql().run("INSERT INTO prompts (id, title, text, created_at, active) VALUES (?,?,?,?,1)", [nanoid(10), "Original (system-prompt.md)", DEFAULT_PROMPT, new Date().toISOString()]);
}

export function listPrompts(): Prompt[] {
  seed();
  return sql().all<Prompt>("SELECT * FROM prompts ORDER BY created_at DESC");
}
export function activePrompt(): Prompt {
  seed();
  return sql().get<Prompt>("SELECT * FROM prompts WHERE active = 1 LIMIT 1") ?? listPrompts()[0];
}
export function activate(id: string): Prompt | null {
  if (!sql().get("SELECT 1 FROM prompts WHERE id = ?", [id])) return null;
  sql().run("UPDATE prompts SET active = 0");
  sql().run("UPDATE prompts SET active = 1 WHERE id = ?", [id]);
  return activePrompt();
}
export function rename(id: string, title: string): void {
  sql().run("UPDATE prompts SET title = ? WHERE id = ?", [title.trim().slice(0, 80) || "Untitled", id]);
}
export async function savePrompt(text: string, title?: string): Promise<Prompt> {
  const prev = activePrompt();
  let t = (title ?? "").trim();
  if (!t) t = await nameFor(prev?.text ?? "", text);
  const id = nanoid(10);
  sql().run("UPDATE prompts SET active = 0");
  sql().run("INSERT INTO prompts (id, title, text, created_at, active) VALUES (?,?,?,?,1)", [id, t, text, new Date().toISOString()]);
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
