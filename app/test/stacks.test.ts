import { describe, expect, test } from "bun:test";
import { groupStacks, stackOfSeq } from "../src/lib/stacks";
import { scrollWithin } from "../src/lib/chatSync";
import type { Chat, ChatMessage } from "../src/lib/chats";

const doc = { nodes: [{ id: "root" }, { id: "a" }, { id: "b" }], tree: { rootNodeId: "root" } };
const msg = (seq: number, role: "user" | "assistant", node_ids: string[] = []): ChatMessage => ({ seq, role, content: `m${seq}`, node_ids, verbatim: null, review: null, trace: null });
const chat = (messages: ChatMessage[]): Chat => ({ id: "c1", title: "", scenario: null, source: "web", status: "open", created_at: "", message_count: messages.length, archived: false, parent_id: null, parent_seq: null, tree_updated_at: null, state: {}, messages });

describe("groupStacks", () => {
  test("one stack per run of replies at the same square, in time order", () => {
    const st = groupStacks(chat([msg(1, "user"), msg(2, "assistant", ["root"]), msg(3, "user"), msg(4, "assistant", ["a"]), msg(5, "user"), msg(6, "assistant", ["a"])]), doc);
    expect(st.map((s) => [s.squareId, s.messages.map((m) => m.seq)])).toEqual([["root", [1, 2]], ["a", [3, 4, 5, 6]]]);
    expect(st.map((s) => s.visit)).toEqual([1, 1]);
  });

  test("a revisit becomes a new later stack instead of joining the earlier one", () => {
    const st = groupStacks(chat([msg(1, "user"), msg(2, "assistant", ["root"]), msg(3, "user"), msg(4, "assistant", ["a"]), msg(5, "user"), msg(6, "assistant", ["root"]), msg(7, "user"), msg(8, "assistant", ["a"])]), doc);
    expect(st.map((s) => s.squareId)).toEqual(["root", "a", "root", "a"]);
    expect(st.map((s) => s.visit)).toEqual([1, 1, 2, 2]);
    expect(st.map((s) => s.firstSeq)).toEqual([1, 3, 5, 7]);
    expect(st.map((s) => s.messages.map((m) => m.seq))).toEqual([[1, 2], [3, 4], [5, 6], [7, 8]]);
  });

  test("every stack holds consecutive messages and covers the chat exactly once", () => {
    const messages = Array.from({ length: 20 }, (_, i) => msg(i + 1, i % 2 ? "assistant" : "user", i % 2 ? [["root", "a", "b", "a"][(i >> 1) % 4]] : []));
    const st = groupStacks(chat(messages), doc);
    const all = st.flatMap((s) => s.messages.map((m) => m.seq));
    expect(all).toEqual(messages.map((m) => m.seq));
    for (const s of st) expect(s.messages.every((m, i) => i === 0 || m.seq === s.messages[i - 1].seq + 1)).toBe(true);
  });

  test("replies without a square stay with the current run, unknown squares fall back to the root", () => {
    const st = groupStacks(chat([msg(1, "user"), msg(2, "assistant", ["a"]), msg(3, "user"), msg(4, "assistant", []), msg(5, "user"), msg(6, "assistant", ["gone"])]), doc);
    expect(st.map((s) => [s.squareId, s.messages.map((m) => m.seq)])).toEqual([["a", [1, 2, 3, 4]], ["root", [5, 6]]]);
  });

  test("a trailing user message without a reply joins the last stack, or the root when there is none", () => {
    expect(groupStacks(chat([msg(1, "user"), msg(2, "assistant", ["a"]), msg(3, "user")]), doc).map((s) => s.messages.length)).toEqual([3]);
    expect(groupStacks(chat([msg(1, "user")]), doc).map((s) => s.squareId)).toEqual(["root"]);
    expect(groupStacks(chat([]), doc)).toEqual([]);
  });

  test("stack ids and keys are unique per stack and stable", () => {
    const st = groupStacks(chat([msg(1, "user"), msg(2, "assistant", ["a"]), msg(3, "user"), msg(4, "assistant", ["root"]), msg(5, "user"), msg(6, "assistant", ["a"])]), doc);
    expect(new Set(st.map((s) => s.id)).size).toBe(3);
    expect(st.map((s) => s.key)).toEqual(["c1:1", "c1:3", "c1:5"]);
    expect(st.map((s) => s.id)).toEqual(["b:c1:1", "b:c1:3", "b:c1:5"]);
    expect(st.every((s) => s.chatId === "c1")).toBe(true);
  });

  test("stackOfSeq finds the stack holding a message", () => {
    const st = groupStacks(chat([msg(1, "user"), msg(2, "assistant", ["a"]), msg(3, "user"), msg(4, "assistant", ["root"])]), doc);
    expect(stackOfSeq(st, 3)?.squareId).toBe("root");
    expect(stackOfSeq(st, 1)?.squareId).toBe("a");
    expect(stackOfSeq(st, 9)).toBeNull();
  });
});

describe("scrollWithin", () => {
  const box = (scrollTop: number, clientHeight = 200) => ({ scrollTop, clientHeight, offsetTop: 0 }) as HTMLElement;
  const el = (offsetTop: number, offsetHeight = 40) => ({ offsetTop, offsetHeight }) as HTMLElement;
  test("scrolls up to an element above the view, keeping a margin", () => { const c = box(500); scrollWithin(el(300), c, 12); expect(c.scrollTop).toBe(288); });
  test("scrolls down to an element below the view, keeping a margin", () => { const c = box(0); scrollWithin(el(300), c, 12); expect(c.scrollTop).toBe(300 + 40 + 12 - 200); });
  test("leaves the scroll alone when the element is already visible", () => { const c = box(100); scrollWithin(el(150), c, 12); expect(c.scrollTop).toBe(100); });
  test("never scrolls above zero", () => { const c = box(50); scrollWithin(el(5), c, 12); expect(c.scrollTop).toBe(0); });
  test("tolerates missing elements", () => { expect(() => scrollWithin(null, box(0))).not.toThrow(); expect(() => scrollWithin(el(1), null)).not.toThrow(); });
});
