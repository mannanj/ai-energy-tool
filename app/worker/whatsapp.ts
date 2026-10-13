import type { Env } from "./env";
import { getChat, sql } from "../../chat/lib/db";
import { runTurn } from "../../chat/lib/turn";
import { translate } from "../../chat/lib/judge";

const GRAPH = "https://graph.facebook.com/v25.0";
const TEXT_ONLY = "I can only read text messages. Please type your question.";
const AI_NOTICE = "Please be mindful this is an AI generated chat bot.";
const STARTED_OVER = "Starting a new chat. Tell me what's going on with your electric bill.";
const START_OVER = /(^|\s)\/\s*start[\s_-]*over\b|^\s*start[\s_-]*over\s*[.!]*\s*$/i;

export const asksToStartOver = (text: string): boolean => START_OVER.test(text);

export interface InboundMessage { id: string; from: string; text: string | null }

interface WebhookBody {
  entry?: { changes?: { field?: string; value?: { messages?: { id: string; from: string; type: string; text?: { body?: string } }[] } }[] }[];
}

const encoder = new TextEncoder();

async function signatureMatches(secret: string, raw: string, header: string | null): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(raw)));
  const expected = encoder.encode([...mac].map((b) => b.toString(16).padStart(2, "0")).join(""));
  const given = encoder.encode(header.slice(7).toLowerCase());
  if (given.length !== expected.length) return false;
  return crypto.subtle.timingSafeEqual(given, expected);
}

export function inboundMessages(body: WebhookBody): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const entry of body.entry ?? [])
    for (const change of entry.changes ?? [])
      for (const m of change.value?.messages ?? [])
        out.push({ id: m.id, from: m.from, text: m.type === "text" ? (m.text?.body ?? "").trim() || null : null });
  return out;
}

export async function whatsappWebhook(req: Request, env: Env, ctx: ExecutionContext, store: DurableObjectStub): Promise<Response> {
  if (req.method === "GET") {
    const q = new URL(req.url).searchParams;
    const ok = q.get("hub.mode") === "subscribe" && !!env.WHATSAPP_VERIFY_TOKEN && q.get("hub.verify_token") === env.WHATSAPP_VERIFY_TOKEN;
    return ok ? new Response(q.get("hub.challenge") ?? "", { headers: { "Content-Type": "text/plain" } }) : new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const raw = await req.text();
  if (!env.WHATSAPP_APP_SECRET || !(await signatureMatches(env.WHATSAPP_APP_SECRET, raw, req.headers.get("X-Hub-Signature-256"))))
    return new Response("bad signature", { status: 401 });
  const messages = inboundMessages(JSON.parse(raw) as WebhookBody);
  for (const m of messages)
    ctx.waitUntil(store.fetch("https://chat-store/whatsapp/turn", { method: "POST", body: JSON.stringify(m) }).then((r) => r.text()));
  return new Response("ok");
}

async function graph(env: Env, body: unknown): Promise<void> {
  const r = await fetch(`${GRAPH}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...(body as object) }),
  });
  if (!r.ok) console.error("whatsapp send failed", r.status, await r.text());
}

function ensureTables(): void {
  sql().run("CREATE TABLE IF NOT EXISTS whatsapp_contacts (wa_id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, updated_at TEXT NOT NULL)");
  sql().run("CREATE TABLE IF NOT EXISTS whatsapp_seen (message_id TEXT PRIMARY KEY, seen_at TEXT NOT NULL)");
}

function firstSighting(messageId: string): boolean {
  if (sql().get("SELECT 1 AS hit FROM whatsapp_seen WHERE message_id = ?", [messageId])) return false;
  sql().run("INSERT INTO whatsapp_seen (message_id, seen_at) VALUES (?, ?)", [messageId, new Date().toISOString()]);
  return true;
}

function openChatFor(waId: string): string | null {
  const row = sql().get<{ chat_id: string }>("SELECT chat_id FROM whatsapp_contacts WHERE wa_id = ?", [waId]);
  const chat = row ? getChat(row.chat_id) : null;
  return chat && chat.status !== "done" && !chat.archived ? chat.id : null;
}

export async function whatsappTurn(env: Env, m: InboundMessage): Promise<void> {
  ensureTables();
  if (!firstSighting(m.id)) return;
  await graph(env, { status: "read", message_id: m.id, typing_indicator: { type: "text" } });
  if (!m.text) { await graph(env, { to: m.from, type: "text", text: { body: TEXT_ONLY } }); return; }
  if (asksToStartOver(m.text)) {
    sql().run("DELETE FROM whatsapp_contacts WHERE wa_id = ?", [m.from]);
    await graph(env, { to: m.from, type: "text", text: { body: STARTED_OVER } });
    return;
  }
  const openChat = openChatFor(m.from);
  const turn = await runTurn(openChat, m.text.slice(0, 4000), { source: "whatsapp" });
  sql().run("INSERT OR REPLACE INTO whatsapp_contacts (wa_id, chat_id, updated_at) VALUES (?, ?, ?)", [m.from, turn.chatId, new Date().toISOString()]);
  const language = turn.state.language ?? "en";
  const notice = language === "en" ? AI_NOTICE : await translate(AI_NOTICE, language).catch(() => AI_NOTICE);
  const body = openChat === turn.chatId ? turn.reply : `${turn.reply}\n\n${notice}`;
  await graph(env, { to: m.from, type: "text", text: { body } });
}
