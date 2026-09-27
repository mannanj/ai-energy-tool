/** Walker tests with a scripted reader and the writer off. Uses a throwaway DB and the fixture tree. */
import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixture } from "./tree.test";

const dir = mkdtempSync(join(tmpdir(), "aet-"));
process.env.DB_PATH = join(dir, "t.sqlite");
process.env.TREE_JSON = join(dir, "tree.json");
writeFileSync(process.env.TREE_JSON, JSON.stringify(fixture()));
const { runTurn, TREE_CHANGED } = await import("../lib/turn");
const { HOLE_REPLY, DECLINE_REPLY } = await import("../lib/tree");
const { getMessages } = await import("../lib/db");

type R = { label?: string | null; onTopic?: boolean; offTopic?: boolean; bye?: boolean; language?: string };
const reader = (script: R[]) => async () => ({ label: null, onTopic: true, offTopic: false, bye: false, language: "en", ...(script.shift() ?? {}) });
const opts = (script: R[]) => ({ verbatimOnly: true, reader: reader(script) });

describe("runTurn", () => {
  test("off-topic first message: one decline, chat done, no square", async () => {
    const t = await runTurn(null, "my water bill", opts([{ onTopic: false }]));
    expect(t.status).toBe("done"); expect(t.reply).toBe(DECLINE_REPLY); expect(t.nodeIds).toEqual([]); expect(t.state.ended_reason).toBe("off_topic");
    const again = await runTurn(t.chatId, "hello?", opts([{}]));
    expect(again.status).toBe("done"); expect(again.reply).toMatch(/has ended/);
  });
  test("on-topic first message walks root -> q and waits", async () => {
    const t = await runTurn(null, "rates went up", opts([{}]));
    expect(t.status).toBe("open"); expect(t.nodeIds).toEqual(["root", "q"]); expect(t.reply).toBe("Do you have a notice?"); expect(t.state.nodeId).toBe("q");
  });
  test("Yes: both Yes leaves and the ride-along are spoken, chat ends as answer", async () => {
    const s = [{}, { label: "Yes" }];
    const a = await runTurn(null, "rates went up", opts(s));
    const b = await runTurn(a.chatId, "yes I do", opts(s));
    expect(b.status).toBe("done"); expect(b.nodeIds.sort()).toEqual(["a", "b", "d"]); expect(b.reply).toContain("Answer A"); expect(b.reply).toContain("Ride-along D"); expect(b.state.ended_reason).toBe("answer");
    expect(b.state.path).toEqual(["root", "q", "a", "b", "d"]);
    const saved = getMessages(b.chatId).filter((m) => m.role === "assistant").pop()!;
    expect(saved.node_id!.split(",").sort()).toEqual(["a", "b", "d"]); expect(saved.verbatim).toBe(b.reply);
  });
  test("No: step C is spoken and waited on; a hole answer gives the 2-1-1 line and ends as hole", async () => {
    const s = [{}, { label: "No" }, { label: "any number" }];
    const a = await runTurn(null, "rates went up", opts(s));
    const b = await runTurn(a.chatId, "no", opts(s));
    expect(b.status).toBe("open"); expect(b.state.nodeId).toBe("c"); expect(b.reply).toContain("Ride-along D"); expect(b.reply).toContain("Step C");
    const c = await runTurn(a.chatId, "four", opts(s));
    expect(c.status).toBe("done"); expect(c.reply).toBe(HOLE_REPLY); expect(c.state.ended_reason).toBe("hole"); expect(c.nodeIds).toEqual(["hole"]);
  });
  test("no match: re-ask once, then the unlabeled fallback on the second miss", async () => {
    const s = [{}, { label: null }, { label: null }];
    const a = await runTurn(null, "rates went up", opts(s));
    const b = await runTurn(a.chatId, "???", opts(s));
    expect(b.status).toBe("open"); expect(b.reply).toMatch(/didn't catch that/); expect(b.nodeIds).toEqual([]); expect(b.state.misses).toBe(1);
    const c = await runTurn(a.chatId, "???", opts(s));
    expect(c.status).toBe("done"); expect(c.nodeIds.sort()).toEqual(["d", "fb"]); expect(c.reply).toContain("Nothing matched");
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
    expect(b.status).toBe("done"); expect(b.state.ended_reason).toBe("resident_ended");
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
    expect(b.status).toBe("done"); expect(b.reply).toBe(TREE_CHANGED); expect(b.state.ended_reason).toBe("tree_changed");
    writeFileSync(process.env.TREE_JSON!, JSON.stringify(fixture()));
  });
  test("language is remembered on the chat", async () => {
    const t = await runTurn(null, "subieron las tarifas", opts([{ language: "es" }]));
    expect(t.state.language).toBe("es");
  });
});
