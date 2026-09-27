import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixture } from "./tree.test";

const dir = mkdtempSync(join(tmpdir(), "aet-"));
process.env.DB_PATH = join(dir, "t.sqlite");
process.env.TREE_JSON = join(dir, "tree.json");
writeFileSync(process.env.TREE_JSON, JSON.stringify(fixture()));
const { runTurn, TREE_CHANGED, GOODBYE } = await import("../lib/turn");
const { HOLE_REPLY, DECLINE_REPLY } = await import("../lib/tree");
const { getMessages } = await import("../lib/db");

type R = { label?: string | null; onTopic?: boolean; offTopic?: boolean; bye?: boolean; language?: string };
const reader = (script: R[]) => async () => ({ label: null, onTopic: true, offTopic: false, bye: false, language: "en", ...(script.shift() ?? {}) });
const opts = (script: R[]) => ({ verbatimOnly: true, reader: reader(script) });

describe("runTurn", () => {
  test("off-topic first message: one decline, chat stays open, next message walks from the root", async () => {
    const t = await runTurn(null, "my water bill", opts([{ onTopic: false }]));
    expect(t.status).toBe("open"); expect(t.reply).toBe(DECLINE_REPLY); expect(t.nodeIds).toEqual([]); expect(t.state.ended_reason).toBe("off_topic"); expect(t.state.nodeId).toBeNull();
    const again = await runTurn(t.chatId, "ok, my electric rates went up", opts([{}]));
    expect(again.status).toBe("open"); expect(again.nodeIds).toEqual(["root", "q"]); expect(again.reply).toBe("Do you have a notice?"); expect(again.state.nodeId).toBe("q");
  });
  test("on-topic first message walks root -> q and waits", async () => {
    const t = await runTurn(null, "rates went up", opts([{}]));
    expect(t.status).toBe("open"); expect(t.nodeIds).toEqual(["root", "q"]); expect(t.reply).toBe("Do you have a notice?"); expect(t.state.nodeId).toBe("q");
  });
  test("Yes: both Yes leaves and the ride-along are spoken, chat ends as answer", async () => {
    const s = [{}, { label: "Yes" }];
    const a = await runTurn(null, "rates went up", opts(s));
    const b = await runTurn(a.chatId, "yes I do", opts(s));
    expect(b.status).toBe("open"); expect(b.state.nodeId).toBeNull(); expect(b.nodeIds.sort()).toEqual(["a", "b", "d"]); expect(b.reply).toContain("Answer A"); expect(b.reply).toContain("Ride-along D"); expect(b.state.ended_reason).toBe("answer");
    expect(b.state.path).toEqual(["root", "q", "a", "b", "d"]);
    const saved = getMessages(b.chatId).filter((m) => m.role === "assistant").pop()!;
    expect(saved.node_id!.split(",").sort()).toEqual(["a", "b", "d"]); expect(saved.verbatim).toBe(b.reply);
    const c = await runTurn(a.chatId, "what else can I do about the bill?", opts([{}]));
    expect(c.status).toBe("open"); expect(c.nodeIds).toEqual(["root", "q"]); expect(c.reply).toBe("Do you have a notice?"); expect(c.state.nodeId).toBe("q");
    expect(c.state.path).toEqual(["root", "q", "a", "b", "d", "root", "q"]);
  });
  test("No: step C is spoken and waited on; a hole answer gives the 2-1-1 line and ends as hole", async () => {
    const s = [{}, { label: "any number" }];
    const a = await runTurn(null, "rates went up", opts(s));
    const b = await runTurn(a.chatId, "no", opts(s));
    expect(b.trace?.tools.some((t) => t.tool === "yes/no" && t.label === "No")).toBe(true); expect(b.trace?.read?.skipped).toBe(true);
    expect(b.status).toBe("open"); expect(b.state.nodeId).toBe("c"); expect(b.reply).toContain("Ride-along D"); expect(b.reply).toContain("Step C");
    const c = await runTurn(a.chatId, "four", opts(s));
    expect(c.status).toBe("open"); expect(c.state.nodeId).toBeNull(); expect(c.reply).toBe(HOLE_REPLY); expect(c.state.ended_reason).toBe("hole"); expect(c.nodeIds).toEqual(["hole"]);
  });
  test("no match: re-ask once, then the unlabeled fallback on the second miss", async () => {
    const s = [{}, { label: null }, { label: null }];
    const a = await runTurn(null, "rates went up", opts(s));
    const b = await runTurn(a.chatId, "???", opts(s));
    expect(b.status).toBe("open"); expect(b.reply).toMatch(/didn't catch that/); expect(b.nodeIds).toEqual([]); expect(b.state.misses).toBe(1);
    const c = await runTurn(a.chatId, "???", opts(s));
    expect(c.state.nodeId).toBeNull(); expect(c.state.ended_reason).toBe("answer"); expect(c.nodeIds.sort()).toEqual(["d", "fb"]); expect(c.reply).toContain("Nothing matched");
    const d = await runTurn(a.chatId, "rates still high", opts([{}]));
    expect(d.state.nodeId).toBe("q"); expect(d.state.misses).toBe(0);
    const e = await runTurn(a.chatId, "???", opts([{ label: null }]));
    expect(e.reply).toMatch(/didn't catch that/); expect(e.state.nodeId).toBe("q");
  });
  test("off-topic mid-chat: decline line plus the same question, position unchanged", async () => {
    const s = [{}, { label: null, offTopic: true }];
    const a = await runTurn(null, "rates went up", opts(s));
    const b = await runTurn(a.chatId, "and my rent?", opts(s));
    expect(b.status).toBe("open"); expect(b.reply.startsWith(DECLINE_REPLY)).toBe(true); expect(b.reply).toContain("Do you have a notice?"); expect(b.state.nodeId).toBe("q");
  });
  test("goodbye without an answer ends the chat", async () => {
    const s = [{}, { label: null, bye: true }];
    const a = await runTurn(null, "rates went up", opts(s));
    const b = await runTurn(a.chatId, "ok thanks bye", opts(s));
    expect(b.status).toBe("open"); expect(b.state.ended_reason).toBe("resident_ended"); expect(b.state.nodeId).toBeNull(); expect(b.reply).toBe(GOODBYE);
  });
  test("thanks after an outcome is a goodbye, not a decline", async () => {
    const s = [{}, { onTopic: false, bye: true }];
    const a = await runTurn(null, "rates went up", opts(s));
    await runTurn(a.chatId, "yes", opts(s));
    const c = await runTurn(a.chatId, "thanks!", opts(s));
    expect(c.reply).toBe(GOODBYE); expect(c.state.ended_reason).toBe("resident_ended"); expect(c.state.nodeId).toBeNull();
  });
  test("a goodbye that also answers counts as the answer", async () => {
    const s = [{}, { label: "Yes", bye: true }];
    const a = await runTurn(null, "rates went up", opts(s));
    const b = await runTurn(a.chatId, "yes, thanks", opts(s));
    expect(b.state.ended_reason).toBe("answer");
  });
  test("tree changed under an open chat: clean stop instead of a crash", async () => {
    const s = [{}, {}];
    const a = await runTurn(null, "rates went up", opts(s));
    const d = fixture(); d.nodes = d.nodes.filter((n) => n.id !== "q"); d.edges = d.edges.filter((e) => e.source !== "q" && e.target !== "q");
    await Bun.sleep(5); writeFileSync(process.env.TREE_JSON!, JSON.stringify(d));
    const b = await runTurn(a.chatId, "yes", opts(s));
    expect(b.status).toBe("open"); expect(b.reply).toBe(TREE_CHANGED); expect(b.state.ended_reason).toBe("tree_changed"); expect(b.state.nodeId).toBeNull();
    writeFileSync(process.env.TREE_JSON!, JSON.stringify(fixture()));
  });
  test("a re-walk skips the income question the facts already answer", async () => {
    const d = fixture();
    d.nodes.push({ id: "inc", text: "Is household income at or under 150% of the federal poverty level? (1 person $1,956/mo, 4 people $4,018/mo)", x: 0, y: 0, width: 240, height: 120, isRoot: false });
    d.nodes.push({ id: "under", text: "You qualify", x: 0, y: 0, width: 240, height: 120, isRoot: false });
    d.nodes.push({ id: "over", text: "You are over the limit", x: 0, y: 0, width: 240, height: 120, isRoot: false });
    d.edges = [{ id: "i0", source: "root", target: "inc" }, { id: "i1", source: "inc", target: "under", label: "Yes" }, { id: "i2", source: "inc", target: "over", label: "No" }];
    d.tree.updatedAt = "2026-09-27T01:00:00Z";
    await Bun.sleep(5); writeFileSync(process.env.TREE_JSON!, JSON.stringify(d));
    const s = [{}, {}, {}];
    const a = await runTurn(null, "rates went up", opts(s));
    expect(a.state.nodeId).toBe("inc");
    const b = await runTurn(a.chatId, "yes", opts(s));
    expect(b.state.ended_reason).toBe("answer"); expect(b.state.nodeId).toBeNull(); expect(b.nodeIds).toEqual(["under"]);
    const c = await runTurn(a.chatId, "we are 4 people and our income is $5,000 a month, the bill went up again", opts(s));
    expect(c.state.facts?.household).toBe(4); expect(c.state.facts?.income_monthly).toBe(5000);
    expect(c.nodeIds).toEqual(["root", "over"]); expect(c.reply).toBe("You are over the limit"); expect(c.state.nodeId).toBeNull(); expect(c.state.ended_reason).toBe("answer");
    expect(c.trace?.tools.some((t) => t.tool === "math" && t.decided && t.label === "No")).toBe(true);
    expect(c.state.path.slice(-3)).toEqual(["root", "inc", "over"]);
    writeFileSync(process.env.TREE_JSON!, JSON.stringify(fixture()));
  });
  test("language is remembered on the chat", async () => {
    const t = await runTurn(null, "subieron las tarifas", opts([{ language: "es" }]));
    expect(t.state.language).toBe("es");
  });
});
