import { getServerByName, routePartykitRequest } from "partyserver";
import type { Env } from "./env";
import { clearCookie, consumeLoginToken, createLoginToken, gateCookie, getSession, hasGate, passwordMatches, sessionCookie, upsertUser, SESSION_COOKIE, GATE_COOKIE } from "./auth";
import { sendMagicLink } from "./email";
import { whatsappWebhook } from "./whatsapp";
import { privacyPage } from "./privacy";
import { CIVIC_SIGNAL_PDF_KEY } from "../src/lib/seed-civic-signal";
import type { TreeInfo } from "../src/types/tree";
export { TreeRoom } from "./room";
export { ChatStore } from "./chat";

const json = (data: unknown, init: ResponseInit = {}) => Response.json(data, init);

function cors(req: Request, env: Env, res: Response): Response {
  const origin = req.headers.get("Origin");
  if (!origin || !env.DEV_ORIGIN || origin !== env.DEV_ORIGIN) return res;
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", origin);
  h.set("Access-Control-Allow-Credentials", "true");
  h.set("Access-Control-Allow-Headers", "Content-Type");
  h.set("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  return new Response(res.body, { status: res.status, headers: h });
}

const newTreeId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10);

async function listTrees(env: Env): Promise<TreeInfo[]> {
  const r = await env.DB.prepare("SELECT id, name, created_at, created_by, pdf_key FROM tree ORDER BY created_at").all<{ id: string; name: string; created_at: string; created_by: string; pdf_key: string | null }>();
  return r.results.map((t) => ({ id: t.id, name: t.name, createdAt: t.created_at, createdBy: t.created_by, pdfKey: t.pdf_key }));
}

async function treeInfo(env: Env, id: string): Promise<TreeInfo | null> {
  const t = await env.DB.prepare("SELECT id, name, created_at, created_by, pdf_key FROM tree WHERE id = ?").bind(id).first<{ id: string; name: string; created_at: string; created_by: string; pdf_key: string | null }>();
  return t ? { id: t.id, name: t.name, createdAt: t.created_at, createdBy: t.created_by, pdfKey: t.pdf_key } : null;
}

async function roomFetch(env: Env, treeId: string, sub: string, author: string, body?: string, method = body === undefined ? "GET" : "POST"): Promise<Response> {
  const stub = await getServerByName(env.TreeRoom as unknown as Parameters<typeof getServerByName>[0], treeId);
  const headers = new Headers({ "Content-Type": "application/json", "x-aet-user": author });
  return stub.fetch(new Request(`https://room/parties/tree-room/${treeId}${sub}`, { method, headers, body }));
}

const isChatApi = (path: string) => path === "/api/chat" || path === "/api/tree" || path.startsWith("/api/chats") || path.startsWith("/api/admin/");
const chatStore = (env: Env) => env.ChatStore.get(env.ChatStore.idFromName("main"));

async function api(req: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  const secure = url.protocol === "https:";
  const path = url.pathname;

  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  if (path === "/api/whatsapp") return whatsappWebhook(req, env, ctx, chatStore(env));

  if (isChatApi(path)) {
    if (!(await getSession(req, env))) return json({ error: "session" }, { status: 401 });
    return chatStore(env).fetch(req);
  }

  if (path === "/api/me" && req.method === "GET") {
    const gate = await hasGate(req, env);
    const s = await getSession(req, env);
    if (!gate) return json({ error: "gate" }, { status: 401 });
    if (!s) return json({ error: "session" }, { status: 401 });
    return json({ id: s.id, firstName: s.firstName, lastName: s.lastName, email: s.email, color: s.color });
  }

  if (path === "/api/gate" && req.method === "POST") {
    const body = await req.json().catch(() => ({})) as { password?: string };
    if (!passwordMatches(body.password ?? "", env.WORKSPACE_PASSWORD)) return json({ error: "Wrong password" }, { status: 403 });
    return json({ ok: true }, { headers: { "Set-Cookie": await gateCookie(env, secure) } });
  }

  if (path === "/api/signin" && req.method === "POST") {
    if (!(await hasGate(req, env))) return json({ error: "gate" }, { status: 401 });
    const b = await req.json().catch(() => ({})) as { firstName?: string; lastName?: string; email?: string };
    const firstName = (b.firstName ?? "").trim(), lastName = (b.lastName ?? "").trim(), email = (b.email ?? "").trim().toLowerCase();
    if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "First name, last name and a valid email are required" }, { status: 400 });
    const user = await upsertUser(env.DB, firstName, lastName, email);
    const token = await createLoginToken(env.DB, user.id);
    const link = `${env.APP_ORIGIN}/api/auth/verify?t=${encodeURIComponent(token)}`;
    await sendMagicLink(env, email, firstName, link);
    return json({ ok: true, ...(env.EMAIL_PROVIDER === "console" ? { devLink: link } : {}) });
  }

  if (path === "/api/auth/verify" && req.method === "GET") {
    const t = url.searchParams.get("t") ?? "";
    const user = t ? await consumeLoginToken(env.DB, t) : null;
    if (!user) return new Response(expiredPage(), { status: 400, headers: { "Content-Type": "text/html;charset=utf-8" } });
    const headers = new Headers({ Location: "/" });
    headers.append("Set-Cookie", await sessionCookie(env, { id: user.id, firstName: user.first_name, lastName: user.last_name, email: user.email, color: user.color }, secure));
    headers.append("Set-Cookie", await gateCookie(env, secure));
    return new Response(null, { status: 302, headers });
  }

  if (path === "/api/signout" && req.method === "POST") {
    const headers = new Headers({ Location: "/signin" });
    headers.append("Set-Cookie", clearCookie(SESSION_COOKIE));
    return json({ ok: true }, { headers });
  }

  if (path === "/api/lock" && req.method === "POST") {
    const headers = new Headers();
    headers.append("Set-Cookie", clearCookie(SESSION_COOKIE));
    headers.append("Set-Cookie", clearCookie(GATE_COOKIE));
    return json({ ok: true }, { headers });
  }

  if (path === "/api/trees") {
    const s = await getSession(req, env);
    if (!s) return json({ error: "session" }, { status: 401 });
    if (req.method === "GET") return json({ trees: await listTrees(env) });
    if (req.method === "POST") {
      const b = (await req.json().catch(() => ({}))) as { name?: string; id?: string; seed?: string };
      const name = (b.name ?? "").trim().slice(0, 80);
      if (!name) return json({ error: "A name is required" }, { status: 400 });
      const id = b.id && /^[\w-]{2,40}$/.test(b.id) ? b.id : newTreeId();
      if (await treeInfo(env, id)) return json({ error: "That tree id already exists" }, { status: 409 });
      const author = `${s.firstName} ${s.lastName}`.trim();
      const created = await roomFetch(env, id, "/init", author, JSON.stringify({ name, seed: b.seed ?? "empty" }));
      if (!created.ok) return json({ error: "Could not create the tree" }, { status: 500 });
      const pdfKey = b.seed === "civic-signal" ? CIVIC_SIGNAL_PDF_KEY : null;
      await env.DB.prepare("INSERT INTO tree (id, name, created_at, created_by, pdf_key) VALUES (?, ?, ?, ?, ?)").bind(id, name, new Date().toISOString(), author, pdfKey).run();
      return json({ ok: true, id });
    }
  }

  const pdf = /^\/api\/tree\/([\w-]+)\/pdf$/.exec(path);
  if (pdf) {
    const s = await getSession(req, env);
    if (!s) return json({ error: "session" }, { status: 401 });
    const info = await treeInfo(env, pdf[1]);
    if (!info) return json({ error: "not found" }, { status: 404 });
    if (req.method === "GET") {
      if (!info.pdfKey) return json({ error: "no pdf" }, { status: 404 });
      const obj = await env.FILES.get(info.pdfKey);
      if (!obj) return json({ error: "no pdf" }, { status: 404 });
      return new Response(obj.body, { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, max-age=60", ETag: obj.httpEtag } });
    }
    if (req.method === "PUT") {
      const key = `trees/${pdf[1]}.pdf`;
      await env.FILES.put(key, req.body, { httpMetadata: { contentType: "application/pdf" } });
      await env.DB.prepare("UPDATE tree SET pdf_key = ? WHERE id = ?").bind(key, pdf[1]).run();
      return json({ ok: true, pdfKey: key });
    }
  }

  const m = /^\/api\/tree\/([\w-]+)\/(export|versions(?:\/\d+(?:\/restore)?)?)$/.exec(path);
  if (m) {
    const s = await getSession(req, env);
    if (!s) return json({ error: "session" }, { status: 401 });
    return roomFetch(env, m[1], `/${m[2]}`, `${s.firstName} ${s.lastName}`.trim(), req.method === "POST" ? await req.text() : undefined, req.method);
  }

  return json({ error: "not found" }, { status: 404 });
}

const expiredPage = () => `<!doctype html><meta charset="utf-8"><title>Link expired</title>
<body style="font-family:-apple-system,sans-serif;max-width:420px;margin:80px auto;padding:0 16px;color:#111">
<h2>This sign-in link is no longer valid</h2><p>Links work once and expire after 20 minutes.</p><p><a href="/signin">Request a new one</a></p></body>`;

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path.startsWith("/api/")) return cors(req, env, await api(req, env, url, ctx));
    if (path === "/privacy") return new Response(privacyPage(env.APP_NAME), { headers: { "Content-Type": "text/html;charset=utf-8" } });

    if (path.startsWith("/parties/")) {
      if (!(await getSession(req, env))) return new Response("unauthorized", { status: 401 });
      return (await routePartykitRequest(req, env as unknown as Record<string, unknown>)) ?? new Response("not found", { status: 404 });
    }

    const isPage = req.method === "GET" && !path.startsWith("/_next/") && !/\.[a-z0-9]+$/i.test(path);
    if (isPage) {
      const gate = await hasGate(req, env);
      const session = gate ? await getSession(req, env) : null;
      if (path === "/gate") { if (gate) return Response.redirect(new URL(session ? "/" : "/signin", url).toString(), 302); }
      else if (path === "/signin") { if (!gate) return Response.redirect(new URL("/gate", url).toString(), 302); if (session) return Response.redirect(new URL("/", url).toString(), 302); }
      else if (!gate) return Response.redirect(new URL("/gate", url).toString(), 302);
      else if (!session) return Response.redirect(new URL("/signin", url).toString(), 302);
      if (session && (path.startsWith("/c/") || path === "/chats")) {
        const file = path === "/chats" ? "/chat/chats.html" : "/chat/index.html";
        return env.ASSETS.fetch(new Request(new URL(file, url).toString(), req));
      }
    }
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
