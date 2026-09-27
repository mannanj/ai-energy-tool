/**
 * Local chat server for the electric-bill helper.
 *
 *  GET  /                 chat page
 *  GET  /c/:id            shared transcript (read-only) + "start your own chat"
 *  GET  /chats            gallery of saved chats
 *  POST /api/chat         { chatId?, message } → SSE stream; first event carries chatId
 *  GET  /api/chats        list
 *  GET  /api/chats/:id    one chat with messages
 *  POST /api/chats/:id/share  mark shared, return link
 *  GET  /api/chats/:id.txt    plain transcript
 *  GET  /api/prompt       the system prompt in use (for the team to inspect)
 *
 * Run: bun server.ts   (reads chat/.env)
 */
import { addMessage, createChat, getChat, getMessages, listChats, shareChat, transcript } from "./lib/db";
import { buildSystemPrompt } from "./lib/prompt";
import { stream, type ChatMessage } from "./lib/llm";

const PORT = Number(process.env.PORT ?? 8972);
const ORIGIN = process.env.PUBLIC_ORIGIN ?? `http://localhost:${PORT}`;
const MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash";
const PUBLIC = new URL("./public/", import.meta.url).pathname;

const json = (data: unknown, status = 200) => Response.json(data, { status });
const page = (name: string) => new Response(Bun.file(PUBLIC + name), { headers: { "Content-Type": "text/html;charset=utf-8" } });
export const shareLink = (id: string) => `${ORIGIN}/c/${id}`;

async function handleChat(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({})) as { chatId?: string; message?: string };
  const text = (body.message ?? "").trim();
  if (!text) return json({ error: "Empty message" }, 400);
  if (text.length > 4000) return json({ error: "Message too long" }, 400);

  let chat = body.chatId ? getChat(body.chatId) : null;
  if (!chat) chat = createChat({ model: MODEL, systemPrompt: buildSystemPrompt() });
  addMessage(chat.id, "user", text);

  const history: ChatMessage[] = [
    { role: "system", content: chat.system_prompt },
    ...getMessages(chat.id).map((m) => ({ role: m.role, content: m.content })),
  ];

  const chatId = chat.id;
  const enc = new TextEncoder();
  const sse = (event: string, data: unknown) => enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const rs = new ReadableStream({
    async start(ctrl) {
      ctrl.enqueue(sse("meta", { chatId, model: MODEL }));
      let full = "";
      try {
        for await (const delta of stream(MODEL, history)) {
          full += delta;
          ctrl.enqueue(sse("delta", delta));
        }
        addMessage(chatId, "assistant", full);
        ctrl.enqueue(sse("done", { chatId }));
      } catch (e) {
        const msg = (e as Error).message;
        if (full) addMessage(chatId, "assistant", full + "\n\n[reply cut off: " + msg + "]");
        ctrl.enqueue(sse("error", { message: msg }));
      }
      ctrl.close();
    },
  });
  return new Response(rs, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Chat-Id": chatId } });
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === "/") return page("index.html");
    if (p === "/chats") return page("chats.html");
    if (p.startsWith("/c/")) return page("index.html");
    if (p === "/app.js") return new Response(Bun.file(PUBLIC + "app.js"), { headers: { "Content-Type": "text/javascript" } });
    if (p === "/style.css") return new Response(Bun.file(PUBLIC + "style.css"), { headers: { "Content-Type": "text/css" } });

    if (p === "/api/chat" && req.method === "POST") return handleChat(req);
    if (p === "/api/prompt") return new Response(buildSystemPrompt(), { headers: { "Content-Type": "text/plain;charset=utf-8" } });
    if (p === "/api/chats" && req.method === "GET") {
      const all = url.searchParams.get("all") === "1";
      return json(listChats({ sharedOnly: !all }).map((c) => ({ ...c, system_prompt: undefined, link: shareLink(c.id) })));
    }
    let m = p.match(/^\/api\/chats\/([A-Za-z0-9]+)\.txt$/);
    if (m) {
      const c = getChat(m[1]);
      if (!c) return json({ error: "Not found" }, 404);
      return new Response(transcript(c, getMessages(c.id)), { headers: { "Content-Type": "text/plain;charset=utf-8" } });
    }
    m = p.match(/^\/api\/chats\/([A-Za-z0-9]+)\/share$/);
    if (m && req.method === "POST") {
      const c = shareChat(m[1]);
      return c ? json({ id: c.id, link: shareLink(c.id), shared_at: c.shared_at }) : json({ error: "Not found" }, 404);
    }
    m = p.match(/^\/api\/chats\/([A-Za-z0-9]+)$/);
    if (m && req.method === "GET") {
      const c = getChat(m[1]);
      if (!c) return json({ error: "Not found" }, 404);
      return json({ ...c, system_prompt: undefined, link: shareLink(c.id), messages: getMessages(c.id) });
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`chat helper on ${ORIGIN}  model ${MODEL}`);
