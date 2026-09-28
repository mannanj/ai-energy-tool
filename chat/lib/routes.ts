import { archiveAllBut, getChat, getMessages, listChats, setArchived, shareChat, transcript } from "./db";
import { activate, activePrompt, listPrompts, rename, savePrompt } from "./prompts";
import { runTurn, READER, ensureTree, tree, treeSource } from "./turn";
import { isHole, validate, activePath } from "./tree";
import { SCENARIOS, rerunFrom, runScenario } from "./simulate";
import { host } from "./host";

const json = (data: unknown, status = 200) => Response.json(data, { status });

async function handleChat(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({})) as { chatId?: string; message?: string };
  const text = (body.message ?? "").trim();
  if (!text) return json({ error: "Empty message" }, 400);
  if (text.length > 4000) return json({ error: "Message too long" }, 400);
  try {
    const t = await runTurn(body.chatId ?? null, text);
    return json({ chatId: t.chatId, reply: t.reply, status: t.status, nodeIds: t.nodeIds, reader: READER() });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}

export async function chatApi(req: Request, origin: string): Promise<Response | null> {
  const shareLink = (id: string) => `${origin}/c/${id}`;
  {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === "/api/chat" && req.method === "POST") return handleChat(req);
    if (p === "/api/tree/import" && req.method === "POST") {
      const doc = await req.json().catch(() => null) as { nodes?: unknown[]; edges?: unknown[]; tree?: { rootNodeId?: string } } | null;
      const v = validate(doc);
      if (v.errors.length) return json({ error: v.errors.join("; "), warnings: v.warnings }, 400);
      host().writeFile(activePath(), JSON.stringify(doc, null, 2));
      const T = tree(); return json({ ok: true, source: treeSource(), report: T.report(), warnings: v.warnings, updatedAt: T.doc.tree.updatedAt });
    }
    if (p === "/api/admin/prompts" && req.method === "GET") return json({ active: activePrompt().id, versions: listPrompts() });
    if (p === "/api/admin/prompts" && req.method === "POST") {
      const b = await req.json().catch(() => ({})) as { text?: string; title?: string };
      if (!b.text?.trim()) return json({ error: "text required" }, 400);
      try { return json(await savePrompt(b.text, b.title)); } catch (e) { return json({ error: (e as Error).message }, 502); }
    }
    let pm = p.match(/^\/api\/admin\/prompts\/([A-Za-z0-9_-]+)\/(activate|rename)$/);
    if (pm && req.method === "POST") {
      const b = await req.json().catch(() => ({})) as { title?: string };
      if (pm[2] === "rename") { rename(pm[1], b.title ?? ""); return json({ ok: true }); }
      const a = activate(pm[1]); return a ? json(a) : json({ error: "Not found" }, 404);
    }
    if (p === "/api/admin/scenarios") return json(SCENARIOS.map((s) => ({ name: s.name, opener: s.opener })));
    if (p === "/api/admin/new" && req.method === "POST") {
      const b = await req.json().catch(() => ({})) as { scenario?: string; opener?: string; persona?: string };
      const sc = SCENARIOS.find((s) => s.name === b.scenario) ?? (b.opener ? { name: "custom", opener: b.opener, persona: b.persona ?? "Answer plausibly and briefly." } : null);
      if (!sc) return json({ error: "scenario or opener required" }, 400);
      const log: string[] = [];
      try { const id = await runScenario(sc, sc.turns ?? 8, (l) => log.push(l)); return json({ id, link: shareLink(id), log }); }
      catch (e) { return json({ error: (e as Error).message, log }, 502); }
    }
    let m = p.match(/^\/api\/chats\/([A-Za-z0-9]+)\/rerun$/);
    if (m && req.method === "POST") {
      const b = await req.json().catch(() => ({})) as { seq?: number };
      const log: string[] = [];
      try { const id = await rerunFrom(m[1], Number(b.seq ?? 1), (l) => log.push(l)); return json({ id, link: shareLink(id), log }); }
      catch (e) { return json({ error: (e as Error).message, log }, 502); }
    }
    if (p === "/api/tree") { const T = await ensureTree(); return json({ source: treeSource(), ...T.doc, report: T.report() }); }
    if (p === "/api/admin/archive" && req.method === "POST") {
      const b = await req.json().catch(() => ({})) as { keep?: number; id?: string; archived?: boolean };
      if (b.id) { setArchived(b.id, b.archived !== false); return json({ ok: true }); }
      return json(archiveAllBut(Number(b.keep ?? 3)));
    }
    if (p === "/api/admin/chats") {
      const T = await ensureTree();
      const includeArchived = url.searchParams.get("archived") === "1";
      const chats = listChats({ sharedOnly: false, limit: 500, includeArchived }).map((c) => {
        const msgs = getMessages(c.id);
        return { id: c.id, title: c.title, scenario: c.scenario, source: c.source, status: c.status, created_at: c.created_at, message_count: msgs.length, archived: !!c.archived,
          parent_id: c.parent_id, parent_seq: c.parent_seq, tree_updated_at: c.tree_updated_at,
          state: (() => { try { return JSON.parse(c.state); } catch { return {}; } })(),
          messages: msgs.map((m) => ({ seq: m.seq, role: m.role, content: m.content, node_ids: m.node_id ? m.node_id.split(",") : [], verbatim: m.verbatim, review: m.review ? JSON.parse(m.review) : null, drafts: m.drafts ? JSON.parse(m.drafts) : null, trace: m.trace ? JSON.parse(m.trace) : null })) };
      });
      const visits: Record<string, number> = {};
      for (const c of chats) for (const m of c.messages) for (const n of m.node_ids) visits[n] = (visits[n] ?? 0) + 1;
      return json({ chats, visits, holes: T.doc.nodes.filter(isHole).map((n) => n.id) });
    }
    if (p === "/api/chats" && req.method === "GET") {
      const all = url.searchParams.get("all") === "1";
      return json(listChats({ sharedOnly: !all }).map((c) => ({ ...c, system_prompt: undefined, link: shareLink(c.id) })));
    }
    m = p.match(/^\/api\/chats\/([A-Za-z0-9]+)\.txt$/);
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
    return null;
  }
}

