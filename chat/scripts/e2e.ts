import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "aet-e2e-"));
const PORT = 8999, BASE = `http://localhost:${PORT}`;
const env = { ...process.env, PORT: String(PORT), DB_PATH: join(dir, "e2e.sqlite"), TREE_JSON: join(dir, "tree.json"), PUBLIC_ORIGIN: BASE, WORKER_ORIGIN: "" };
const n = (id: string, text: string, x: number, y: number, isRoot = false) => ({ id, text, x, y, width: 260, height: 120, isRoot });
const e = (id: string, source: string, target: string, label?: string) => ({ id, source, target, label });
const TREE = {
  version: 1, tree: { id: "e2e", name: "e2e", rootNodeId: "root", updatedAt: new Date().toISOString() },
  nodes: [
    n("root", "The rates for electricity have increased making it hard to make ends meet, what can I do?", 0, 0, true),
    n("step0", "Do you have a disconnection notice, is your power already off, or does anyone in your home use medical equipment that needs electricity?", 0, 200),
    n("urgent", "Call Dominion Energy at 866-366-4357 for a payment plan, and call 2-1-1 (24/7). For medical equipment, email demedical@domenergy.com.", -300, 400),
    n("heat", "Do you heat your home with electricity, or with gas, oil, or something else?", 100, 400),
    n("elec", "With electric heat, PIPP sets your payment at 10% of income. Apply at commonhelp.virginia.gov or call 703-324-7500.", -100, 600),
    n("gas", "", 300, 600),
  ],
  edges: [e("a", "root", "step0"), e("b", "step0", "urgent", "Yes"), e("c", "step0", "heat", "No"), e("d", "heat", "elec", "Electric"), e("f", "heat", "gas", "Gas or other")],
};
writeFileSync(env.TREE_JSON, JSON.stringify(TREE));

const server = Bun.spawn(["bun", "server.ts"], { cwd: resolve(import.meta.dir, ".."), env, stdout: "pipe", stderr: "pipe" });
const fails: string[] = [];
const check = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? "  " + detail : ""}`); if (!ok) fails.push(name); };
const post = async (p: string, body: unknown) => { const r = await fetch(BASE + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { s: r.status, j: await r.json() as any }; };
const chat = (chatId: string | null, message: string) => post("/api/chat", { chatId, message }).then((r) => r.j);
try {
  for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + "/")).ok) break; } catch {} await Bun.sleep(250); }
  const t = await fetch(BASE + "/api/tree").then((r) => r.json());
  check("tree loaded with one hole", t.report.holes.join() === "gas" && t.nodes.length === 6);

  let r = await chat(null, "My water bill is crazy high, can you help?");
  check("water bill: declined and done", r.status === "done" && /can only help/.test(r.reply), r.reply.slice(0, 60));

  r = await chat(null, "The rates for electricity have increased making it hard to make ends meet, what can I do?");
  check("opener: step0 asked, open", r.status === "open" && r.nodeIds.includes("step0"));
  const urgentChat = r.chatId;
  r = await chat(urgentChat, "yes, I got a disconnection notice yesterday");
  check("Yes -> urgent leaf, done, numbers kept", r.status === "done" && r.nodeIds.includes("urgent") && r.reply.includes("866-366-4357") && r.reply.includes("2-1-1"), r.reply.slice(0, 80));

  r = await chat(null, "Electric got expensive and I can't make ends meet");
  const mainChat = r.chatId;
  r = await chat(mainChat, "no notice, power is on, no medical stuff");
  check("No -> heat question", r.status === "open" && r.nodeIds.includes("heat"), r.reply.slice(0, 60));
  r = await chat(mainChat, "we have a heat pump so electric");
  check("Electric -> answer, done, PIPP facts intact", r.status === "done" && r.nodeIds.includes("elec") && r.reply.includes("commonhelp.virginia.gov") && r.reply.includes("703-324-7500"), r.reply.slice(0, 80));
  r = await chat(mainChat, "anything else?");
  check("ended chat stays ended", r.status === "done" && /has ended/.test(r.reply));

  r = await chat(null, "help with my electric bill please");
  const holeChat = r.chatId;
  await chat(holeChat, "no, none of those");
  r = await chat(holeChat, "gas furnace");
  check("Gas -> hole -> 2-1-1 line, done", r.status === "done" && r.nodeIds.includes("gas") && /2-1-1/.test(r.reply) && /don't have a checked answer/.test(r.reply), r.reply.slice(0, 80));

  const adm = await fetch(BASE + "/api/admin/chats").then((x) => x.json());
  const mc = adm.chats.find((c: any) => c.id === mainChat);
  const last = mc.messages.filter((m: any) => m.role === "assistant").slice(-2)[0];
  check("admin api: squares + verbatim + review on replies", last.node_ids.includes("elec") && typeof last.verbatim === "string" && last.review && ["written", "verbatim"].includes(last.review.used), `used=${last.review?.used} ${last.review?.reason ?? ""}`);
  check("admin api: visits counted", adm.visits.step0 >= 3 && adm.holes.join() === "gas");

  let imp = await post("/api/tree/import", { nodes: [], edges: [] });
  check("import rejects garbage", imp.s === 400);
  const edited = JSON.parse(JSON.stringify(TREE)); edited.nodes[5].text = "With gas heat, PIPP sets your payment at 6% of income. Apply at commonhelp.virginia.gov.";
  edited.tree.updatedAt = new Date(Date.now() + 1000).toISOString();
  imp = await post("/api/tree/import", edited);
  check("import accepts edited tree, no holes now", imp.s === 200 && imp.j.report.holes.length === 0);

  const rr = await post(`/api/chats/${holeChat}/rerun`, { seq: 6 });
  check("rerun creates a linked chat", rr.s === 200 && !!rr.j.id, rr.j.error ?? "");
  const adm2 = await fetch(BASE + "/api/admin/chats").then((x) => x.json());
  const rc = adm2.chats.find((c: any) => c.id === rr.j.id);
  check("rerun: replayed path reaches the edited square and is done", !!rc && rc.parent_id === holeChat && rc.status === "done" && rc.messages.some((m: any) => m.node_ids.includes("gas")) && rc.messages.at(-1).content.includes("6%"), rc?.messages.at(-1)?.content.slice(0, 80));

} catch (err) { check("e2e crashed", false, (err as Error).stack ?? String(err)); }
finally { server.kill(); }
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join("; ")}` : "\nall e2e checks passed");
process.exit(fails.length ? 1 : 0);
