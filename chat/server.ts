import { ensureTree, treeSource, READER } from "./lib/turn";
import { chatApi } from "./lib/routes";

const PORT = Number(process.env.PORT ?? 8972);
const ORIGIN = process.env.PUBLIC_ORIGIN ?? `http://localhost:${PORT}`;
const MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash";
const PUBLIC = new URL("./public/", import.meta.url).pathname;

const CORS_ORIGINS = (process.env.CHAT_CORS_ORIGIN ?? "http://localhost:3010,http://localhost:8971").split(",").map((s) => s.trim());
function cors(req: Request, res: Response): Response {
  const origin = req.headers.get("Origin");
  if (!origin || !CORS_ORIGINS.includes(origin)) return res;
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", origin); h.set("Access-Control-Allow-Headers", "Content-Type"); h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS"); h.set("Vary", "Origin");
  return new Response(res.body, { status: res.status, headers: h });
}
const page = (name: string) => new Response(Bun.file(PUBLIC + name), { headers: { "Content-Type": "text/html;charset=utf-8" } });
export const shareLink = (id: string) => `${ORIGIN}/c/${id}`;

Bun.serve({
  port: PORT,
  async fetch(req) {
    if (req.method === "OPTIONS") return cors(req, new Response(null, { status: 204 }));
    const p = new URL(req.url).pathname;
    if (p === "/") return page("index.html");
    if (p === "/chats") return page("chats.html");
    if (p.startsWith("/c/")) return page("index.html");
    if (p === "/app.js") return new Response(Bun.file(PUBLIC + "app.js"), { headers: { "Content-Type": "text/javascript" } });
    if (p === "/style.css") return new Response(Bun.file(PUBLIC + "style.css"), { headers: { "Content-Type": "text/css" } });
    return cors(req, (await chatApi(req, ORIGIN)) ?? new Response("Not found", { status: 404 }));
  },
});

ensureTree().then((T) => { const r = T.report(); console.log(`chat helper on ${ORIGIN}  tree ${treeSource()} (${r.nodes} squares, ${r.edges} arrows, ${r.holes.length} holes, ${r.unreachable.length} unreachable)  reader ${READER()}  writer ${MODEL}`); });
