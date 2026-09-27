/**
 * Worker entry: static Next export + auth API + Durable Object rooms.
 *
 *  /gate, /signin      public pages (signin needs the gate cookie)
 *  /api/*              auth endpoints
 *  /parties/tree-room/:id   WebSocket (needs session cookie)
 *  everything else     needs gate + session, then served from assets
 */
import { getServerByName, routePartykitRequest } from "partyserver";
import type { Env } from "./env";
import { clearCookie, consumeLoginToken, createLoginToken, gateCookie, getSession, hasGate, passwordMatches, sessionCookie, upsertUser, SESSION_COOKIE, GATE_COOKIE } from "./auth";
import { sendMagicLink } from "./email";
export { TreeRoom } from "./room";

const json = (data: unknown, init: ResponseInit = {}) => Response.json(data, init);

function cors(req: Request, env: Env, res: Response): Response {
  const origin = req.headers.get("Origin");
  if (!origin || !env.DEV_ORIGIN || origin !== env.DEV_ORIGIN) return res;
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", origin);
  h.set("Access-Control-Allow-Credentials", "true");
  h.set("Access-Control-Allow-Headers", "Content-Type");
  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  return new Response(res.body, { status: res.status, headers: h });
}

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  const secure = url.protocol === "https:";
  const path = url.pathname;

  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

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
    // clicking the link in a browser that never entered the password still counts: the link proves the email
    headers.append("Set-Cookie", await gateCookie(env, secure));
    return new Response(null, { status: 302, headers });
  }

  if (path === "/api/signout" && req.method === "POST") {
    const headers = new Headers({ Location: "/signin" });
    headers.append("Set-Cookie", clearCookie(SESSION_COOKIE));
    return json({ ok: true }, { headers });
  }

  if (path === "/api/lock" && req.method === "POST") {
    // forget the password in this browser too (used by "sign out everywhere")
    const headers = new Headers();
    headers.append("Set-Cookie", clearCookie(SESSION_COOKIE));
    headers.append("Set-Cookie", clearCookie(GATE_COOKIE));
    return json({ ok: true }, { headers });
  }

  // /api/tree/:id/(export|versions|versions/:n|versions/:n/restore) → the room's HTTP handler
  const m = /^\/api\/tree\/([\w-]+)\/(export|versions(?:\/\d+(?:\/restore)?)?)$/.exec(path);
  if (m) {
    const s = await getSession(req, env);
    if (!s) return json({ error: "session" }, { status: 401 });
    const stub = await getServerByName(env.TreeRoom as unknown as Parameters<typeof getServerByName>[0], m[1]);
    const headers = new Headers({ "Content-Type": "application/json", "x-aet-user": `${s.firstName} ${s.lastName}`.trim() });
    return stub.fetch(new Request(`https://room/parties/tree-room/${m[1]}/${m[2]}`, { method: req.method, headers, body: req.method === "POST" ? await req.text() : undefined }));
  }

  return json({ error: "not found" }, { status: 404 });
}

const expiredPage = () => `<!doctype html><meta charset="utf-8"><title>Link expired</title>
<body style="font-family:-apple-system,sans-serif;max-width:420px;margin:80px auto;padding:0 16px;color:#111">
<h2>This sign-in link is no longer valid</h2><p>Links work once and expire after 20 minutes.</p><p><a href="/signin">Request a new one</a></p></body>`;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path.startsWith("/api/")) return cors(req, env, await api(req, env, url));

    if (path.startsWith("/parties/")) {
      if (!(await getSession(req, env))) return new Response("unauthorized", { status: 401 });
      return (await routePartykitRequest(req, env as unknown as Record<string, unknown>)) ?? new Response("not found", { status: 404 });
    }

    // static assets: gate the pages, not the chunks
    const isPage = req.method === "GET" && !path.startsWith("/_next/") && !/\.[a-z0-9]+$/i.test(path);
    if (isPage) {
      const gate = await hasGate(req, env);
      const session = gate ? await getSession(req, env) : null;
      if (path === "/gate") { if (gate) return Response.redirect(new URL(session ? "/" : "/signin", url).toString(), 302); }
      else if (path === "/signin") { if (!gate) return Response.redirect(new URL("/gate", url).toString(), 302); if (session) return Response.redirect(new URL("/", url).toString(), 302); }
      else if (!gate) return Response.redirect(new URL("/gate", url).toString(), 302);
      else if (!session) return Response.redirect(new URL("/signin", url).toString(), 302);
    }
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
